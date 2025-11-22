import { blackboardService } from '@/src/blackboard/service';
import { jobQueue } from '@/src/jobs/queue';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { cleanupCompletedTasks } from './taskCleanup';
import { taskManager } from '@/src/orchestrator/taskManager';

/**
 * Check if a task is complete (all assigned agents have completed their work)
 * and trigger WeSpeaker to provide final response
 */
export async function checkTaskCompletion(taskId: string): Promise<boolean> {
  const task = await blackboardService.findById(taskId);
  if (!task || task.type !== 'task') {
    return false;
  }

  // Get all agents assigned to this task
  let assignedAgents = task.dimensions?.assigned_agents || 
    (task.dimensions?.assigned_agent ? [task.dimensions.assigned_agent] : []);
  
  console.log(`[checkTaskCompletion] Task ${taskId}: assigned_agents=${JSON.stringify(assignedAgents)}, assigned_agent=${task.dimensions?.assigned_agent}`);
  
  // If no assigned agents in task dimensions, try to infer from outputs
  if (assignedAgents.length === 0) {
    const allOutputs = await blackboardService.query({
      type: 'agent_output',
      parent_id: taskId,
    });
    
    if (allOutputs.length > 0) {
      // Infer assigned agents from outputs (exclude system agents)
      const excludedAgents = ['WeSpeaker', 'TaskPlanner', 'Judge', 'GoalRefiner'];
      const inferredAgents = Array.from(new Set(
        allOutputs
          .map(o => o.dimensions?.agent_id)
          .filter(Boolean)
          .filter(id => !excludedAgents.includes(id as string))
      ));
      
      if (inferredAgents.length > 0) {
        console.log(`[checkTaskCompletion] Task ${taskId} has no assigned_agents in dimensions, but found outputs from: ${inferredAgents.join(', ')}. Using inferred agents.`);
        assignedAgents = inferredAgents;
        
        // Update task with inferred agents for future reference
        await blackboardService.update(taskId, {
          dimensions: {
            ...task.dimensions,
            assigned_agents: inferredAgents,
            assigned_agent: inferredAgents[0],
          },
        });
      }
    }
  }
  
  if (assignedAgents.length === 0) {
    console.log(`[checkTaskCompletion] Task ${taskId} has no assigned agents and no outputs, cannot check completion`);
    return false;
  }

  // Get all agent outputs for this task
  const outputs = await blackboardService.query({
    type: 'agent_output',
    parent_id: taskId,
  });

  // Filter to only outputs from assigned agents
  const assignedOutputs = outputs.filter(output => 
    assignedAgents.includes(output.dimensions?.agent_id)
  );

  // Check if we have outputs from all assigned agents
  const agentsWithOutputs = new Set(
    assignedOutputs.map(o => o.dimensions?.agent_id).filter(Boolean)
  );
  
  console.log(`[checkTaskCompletion] Task ${taskId}: agentsWithOutputs=${JSON.stringify(Array.from(agentsWithOutputs))}, assignedAgents=${JSON.stringify(assignedAgents)}`);
  
  const allAgentsComplete = assignedAgents.every((agentId: string) => 
    agentsWithOutputs.has(agentId)
  );
  
  console.log(`[checkTaskCompletion] Task ${taskId}: allAgentsComplete=${allAgentsComplete}, current status=${task.dimensions?.status}`);

  if (allAgentsComplete && task.dimensions?.status !== 'completed') {
    // Read fresh task to ensure we have current dimensions
    const freshTask = await blackboardService.findById(taskId);
    if (!freshTask) {
      console.error(`[checkTaskCompletion] Task ${taskId} not found when trying to mark as completed`);
      return false;
    }
    
    console.log(`[checkTaskCompletion] Marking task ${taskId} as completed. Current dimensions: ${JSON.stringify(freshTask.dimensions)}`);
    
    // Mark task as completed - preserve all existing dimensions
    const updated = await blackboardService.update(taskId, {
      dimensions: {
        ...(freshTask.dimensions || {}),
        status: 'completed',
        assigned_agents: assignedAgents, // Ensure assigned agents are set
        assigned_agent: assignedAgents[0], // Keep first for backward compatibility
      },
    });
    
    if (updated) {
      console.log(`[checkTaskCompletion] Successfully updated task ${taskId} to completed. New dimensions: ${JSON.stringify(updated.dimensions)}`);
      
      // Verify the update persisted
      const verifyTask = await blackboardService.findById(taskId);
      if (verifyTask) {
        console.log(`[checkTaskCompletion] Verification - task ${taskId} status after update: ${verifyTask.dimensions?.status}`);
        if (verifyTask.dimensions?.status !== 'completed') {
          console.error(`[checkTaskCompletion] WARNING: Task ${taskId} status update did not persist! Expected 'completed', got '${verifyTask.dimensions?.status}'`);
        }
      }
    } else {
      console.error(`[checkTaskCompletion] Failed to update task ${taskId} to completed`);
    }

    await eventsRepository.create({
      type: 'task_completed',
      blackboard_item_id: taskId,
      data: {
        status: 'completed',
        assigned_agents: assignedAgents,
        output_count: assignedOutputs.length,
      },
    });

    // When a task completes, check if any dependent tasks can now start
    // Find tasks that depend on this completed task
    const dependentTasks = await blackboardService.query({
      type: 'task',
      parent_id: task.links.parents?.[0] || '', // Get all tasks for the same goal
    });

    for (const depTask of dependentTasks) {
      const depDependencies = depTask.dimensions?.dependencies;
      if (Array.isArray(depDependencies) && depDependencies.includes(taskId)) {
        // This task depends on the completed task, check if it can now start
        const canStart = await taskManager.canTaskStart(depTask.id);
        if (canStart && depTask.dimensions?.status === 'assigned') {
          // Try to assign agents to this dependent task
          await taskManager.assignAgentToTask(depTask.id);
        }
      }
    }

    // Get the goal this task belongs to
    const goalId = task.links.parents?.[0];
    if (goalId) {
      // Check if all tasks for this goal are complete
      const allTasks = await blackboardService.findChildren(goalId);
      const taskItems = allTasks.filter(t => t.type === 'task');
      
      console.log(`[checkTaskCompletion] Goal ${goalId} has ${taskItems.length} tasks. Checking completion status...`);
      const taskStatuses = taskItems.map(t => ({ id: t.id, status: t.dimensions?.status, summary: t.summary.substring(0, 50) }));
      console.log(`[checkTaskCompletion] Task statuses: ${JSON.stringify(taskStatuses)}`);
      
      const allTasksComplete = taskItems.every(t => 
        t.dimensions?.status === 'completed'
      );
      
      console.log(`[checkTaskCompletion] All tasks complete for goal ${goalId}: ${allTasksComplete}`);

      // If not all tasks are complete, check for stuck tasks and retry them
      if (!allTasksComplete) {
        const incompleteTasks = taskItems.filter(t => 
          t.dimensions?.status !== 'completed' && 
          (t.dimensions?.status === 'assigned' || t.dimensions?.status === 'working')
        );
        
        if (incompleteTasks.length > 0) {
          console.log(`[checkTaskCompletion] Found ${incompleteTasks.length} incomplete tasks for goal ${goalId}, checking if they need retry...`);
          
          // Check for stuck tasks (assigned/working for more than 5 minutes without output)
          const now = Date.now();
          const STUCK_TASK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
          
          for (const task of incompleteTasks) {
            const taskAge = now - new Date(task.created_at || 0).getTime();
            const updatedAge = task.updated_at ? now - new Date(task.updated_at).getTime() : taskAge;
            
            // Check if task has outputs
            const taskOutputs = await blackboardService.query({
              type: 'agent_output',
              parent_id: task.id,
            });
            
            // Task is stuck if:
            // 1. It's been assigned/working for > 5 minutes
            // 2. No outputs exist
            // 3. It was updated more than 5 minutes ago
            const isStuck = (updatedAge > STUCK_TASK_THRESHOLD) && taskOutputs.length === 0;
            
            if (isStuck) {
              console.log(`[checkTaskCompletion] Task ${task.id} appears stuck (${Math.round(updatedAge / 1000)}s old, no outputs), retrying assignment...`);
              
              // Retry assignment
              try {
                await taskManager.assignAgentToTask(task.id);
              } catch (error) {
                console.error(`[checkTaskCompletion] Error retrying assignment for task ${task.id}:`, error);
              }
            }
          }
        }
      }

      if (allTasksComplete && taskItems.length > 0) {
        console.log(`[checkTaskCompletion] Triggering WeSpeaker for goal ${goalId} with ${taskItems.length} completed tasks`);
        // All tasks complete - trigger WeSpeaker to provide final response
        await triggerWeSpeakerForGoal(goalId, taskId);
      } else if (taskItems.length === 0) {
        console.log(`[checkTaskCompletion] No tasks found for goal ${goalId}, skipping WeSpeaker trigger`);
      }
    }

    return true;
  }

  return false;
}

/**
 * Trigger WeSpeaker to provide final response when goal tasks are complete
 */
export async function triggerWeSpeakerForGoal(goalId: string, completedTaskId: string): Promise<void> {
  try {
    console.log(`[triggerWeSpeakerForGoal] Starting for goal ${goalId}, completed task ${completedTaskId}`);
    // Get the goal
    const goal = await blackboardService.findById(goalId);
    if (!goal) {
      console.error(`[triggerWeSpeakerForGoal] Goal ${goalId} not found`);
      return;
    }
    console.log(`[triggerWeSpeakerForGoal] Found goal: ${goal.summary.substring(0, 100)}`);
    const webEnabled = goal.dimensions?.web_enabled ?? false;

    // Get all tasks for this goal
    const tasks = await blackboardService.findChildren(goalId);
    const taskItems = tasks.filter(t => t.type === 'task');

    // Get all agent outputs for all tasks
    const allOutputs = [];
    for (const task of taskItems) {
      const outputs = await blackboardService.query({
        type: 'agent_output',
        parent_id: task.id,
      });
      allOutputs.push(...outputs);
    }

    // Get judgements for these outputs (query by parent_id for each output)
    const allJudgements = [];
    for (const output of allOutputs) {
      const outputJudgements = await blackboardService.query({
        type: 'judgement',
        parent_id: output.id,
      });
      allJudgements.push(...outputJudgements);
    }
    const judgements = allJudgements;

    // Get full blackboard context in card format (same as blackboard view)
    const blackboardContext = await blackboardService.getContextForAgent(goalId);
    
    // Build detailed context for WeSpeaker with full task outputs
    const taskDetails = [];
    for (const task of taskItems) {
      // Find outputs linked to this task
      const taskOutputs = allOutputs.filter(o => {
        return o.links?.parents?.includes(task.id);
      });
      
      // Also check children of the task
      const taskChildren = await blackboardService.findChildren(task.id);
      const childOutputIds = new Set(taskChildren.map(c => c.id));
      taskOutputs.push(...allOutputs.filter(o => childOutputIds.has(o.id)));
      
      // Get full content from each output (not truncated)
      const outputDetails = taskOutputs.map(o => {
        const content = (o.detail as any)?.content || o.summary || '';
        const agentId = o.dimensions?.agent_id || 'Unknown';
        const summary = o.summary || content.substring(0, 200);
        return `  Worker: ${agentId}\n  Summary: ${summary}\n  Full Output: ${content}`;
      }).join('\n\n');
      
      taskDetails.push(`Task: ${task.summary}\nStatus: ${task.dimensions?.status || 'unknown'}\nPriority: ${task.dimensions?.priority || 'medium'}\n\nOutputs:\n${outputDetails || '  (No outputs yet)'}`);
    }

    const taskDetailsText = taskDetails.join('\n\n---\n\n');
    
    // Get user request for context
    const userRequest = goal.links?.parents?.[0] 
      ? await blackboardService.findById(goal.links.parents[0])
      : null;
    const userRequestText = userRequest && userRequest.type === 'user_request' 
      ? `Original User Request: ${userRequest.summary}\n\n`
      : '';
    
    const contextMessage = `${userRequestText}All tasks for the goal "${goal.summary}" have been completed. 

Here is the complete blackboard context (same view as the blackboard page):

${blackboardContext}

---

Detailed Task Results:

${taskDetailsText}

---

Please provide a comprehensive, natural response to the user summarizing what was accomplished. Include specific details from all the task outputs above. Be conversational and helpful. Reference specific information from the task outputs (hotel names, prices, dates, recommendations, etc.) rather than just saying "tasks were completed".`;

    // Create job for WeSpeaker
    console.log(`[triggerWeSpeakerForGoal] Creating WeSpeaker job for goal ${goalId}`);
    const weSpeakerJob = await jobQueue.createRunAgentJob(
      'WeSpeaker',
      {
        goal_id: goalId,
        message: contextMessage,
        task_completion: true,
        completed_tasks: taskItems.map(t => t.id),
        cleanup_after: false, // Don't delete tasks - keep them in blackboard
        web_enabled: webEnabled,
      },
      {
        temperature: 0.7,
        maxTokens: 20000,
      }
    );
    
    console.log(`[triggerWeSpeakerForGoal] Created WeSpeaker job ${weSpeakerJob.id} for goal ${goalId}`);
    
    // Try to process immediately
    try {
      const { jobScheduler } = await import('@/src/jobs/scheduler');
      await jobScheduler.processJobImmediately(weSpeakerJob.id);
      console.log(`[triggerWeSpeakerForGoal] WeSpeaker job ${weSpeakerJob.id} processed immediately`);
    } catch (error) {
      console.log(`[triggerWeSpeakerForGoal] WeSpeaker job ${weSpeakerJob.id} will be processed by scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Note: Task cleanup will happen after WeSpeaker completes (handled in processor)
  } catch (error) {
    console.error(`[triggerWeSpeakerForGoal] Error triggering WeSpeaker for goal ${goalId}:`, error);
  }
}

