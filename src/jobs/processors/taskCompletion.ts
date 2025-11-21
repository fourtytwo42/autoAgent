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
  const assignedAgents = task.dimensions?.assigned_agents || 
    (task.dimensions?.assigned_agent ? [task.dimensions.assigned_agent] : []);
  
  console.log(`[checkTaskCompletion] Task ${taskId}: assigned_agents=${JSON.stringify(assignedAgents)}, assigned_agent=${task.dimensions?.assigned_agent}`);
  
  if (assignedAgents.length === 0) {
    console.log(`[checkTaskCompletion] Task ${taskId} has no assigned agents, cannot check completion`);
    return false;
  }

  // Get all agent outputs for this task
  const outputs = await blackboardService.query({
    type: 'agent_output',
    links: { parents: [taskId] },
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
  
  const allAgentsComplete = assignedAgents.every(agentId => 
    agentsWithOutputs.has(agentId)
  );
  
  console.log(`[checkTaskCompletion] Task ${taskId}: allAgentsComplete=${allAgentsComplete}, current status=${task.dimensions?.status}`);

  if (allAgentsComplete && task.dimensions?.status !== 'completed') {
    // Mark task as completed
    await blackboardService.update(taskId, {
      dimensions: {
        ...task.dimensions,
        status: 'completed',
      },
    });

    await eventsRepository.create({
      type: 'task_completed',
      blackboard_item_id: taskId,
      data: {
        assigned_agents: assignedAgents,
        output_count: assignedOutputs.length,
      },
    });

    // When a task completes, check if any dependent tasks can now start
    // Find tasks that depend on this completed task
    const dependentTasks = await blackboardService.query({
      type: 'task',
      links: { parents: [task.links.parents?.[0] || ''] }, // Get all tasks for the same goal
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
      const allTasksComplete = taskItems.every(t => 
        t.dimensions?.status === 'completed'
      );

      if (allTasksComplete) {
        // All tasks complete - trigger WeSpeaker to provide final response
        await triggerWeSpeakerForGoal(goalId, taskId);
      }
    }

    return true;
  }

  return false;
}

/**
 * Trigger WeSpeaker to provide final response when goal tasks are complete
 */
async function triggerWeSpeakerForGoal(goalId: string, completedTaskId: string): Promise<void> {
  try {
    // Get the goal
    const goal = await blackboardService.findById(goalId);
    if (!goal) {
      return;
    }
    const webEnabled = goal.dimensions?.web_enabled ?? false;

    // Get all tasks for this goal
    const tasks = await blackboardService.findChildren(goalId);
    const taskItems = tasks.filter(t => t.type === 'task');

    // Get all agent outputs for all tasks
    const allOutputs = [];
    for (const task of taskItems) {
      const outputs = await blackboardService.query({
        type: 'agent_output',
        links: { parents: [task.id] },
      });
      allOutputs.push(...outputs);
    }

    // Get judgements for these outputs
    const judgements = await blackboardService.query({
      type: 'judgement',
      links: { parents: allOutputs.map(o => o.id) },
    });

    // Build context for WeSpeaker
    const taskSummaries = taskItems.map(t => `- ${t.summary} (${t.dimensions?.status || 'unknown'})`).join('\n');
    const outputSummaries = allOutputs.map(o => {
      const judgement = judgements.find(j => j.links.parents?.includes(o.id));
      const score = judgement?.dimensions?.score || 'N/A';
      return `- ${o.dimensions?.agent_id}: ${o.summary.substring(0, 100)}... (Score: ${score})`;
    }).join('\n');

    const contextMessage = `All tasks for the goal "${goal.summary}" have been completed.\n\nTasks completed:\n${taskSummaries}\n\nAgent outputs:\n${outputSummaries}\n\nPlease provide a comprehensive summary to the user about what was accomplished.`;

    // Create job for WeSpeaker
    const weSpeakerJob = await jobQueue.createRunAgentJob(
      'WeSpeaker',
      {
        goal_id: goalId,
        message: contextMessage,
        task_completion: true,
        completed_tasks: taskItems.map(t => t.id),
        cleanup_after: true, // Flag to clean up tasks after response
        web_enabled: webEnabled,
      },
      {
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    // Note: Task cleanup will happen after WeSpeaker completes (handled in processor)
  } catch (error) {
    console.error('Error triggering WeSpeaker for goal completion:', error);
  }
}

