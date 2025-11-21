import { BaseJobProcessor } from './base.processor';
import { Job, JobType, RunAgentJobPayload } from '@/src/types/jobs';
import { agentRegistry } from '@/src/agents/registry';
import { WeSpeakerAgent } from '@/src/agents/agents/wespeaker.agent';
import { TaskPlannerAgent } from '@/src/agents/agents/taskPlanner.agent';
import { JudgeAgent } from '@/src/agents/agents/judge.agent';
import { StewardAgent } from '@/src/agents/agents/steward.agent';
import { ModelEvaluatorAgent } from '@/src/agents/agents/modelEvaluator.agent';
import { ConsensusAgent } from '@/src/agents/agents/consensus.agent';
import { ArchitectureEngineerAgent } from '@/src/agents/agents/architectureEngineer.agent';
import { MemoryCuratorAgent } from '@/src/agents/agents/memoryCurator.agent';
import { WorkerAgent } from '@/src/agents/agents/worker.agent';
import { GoalRefinerAgent } from '@/src/agents/agents/goalRefiner.agent';
import { ResearchWorkerAgent } from '@/src/agents/agents/researchWorker.agent';
import { WritingWorkerAgent } from '@/src/agents/agents/writingWorker.agent';
import { AnalysisWorkerAgent } from '@/src/agents/agents/analysisWorker.agent';
import { blackboardService } from '@/src/blackboard/service';
import { agentMetricsRepository } from '@/src/db/repositories/agentMetrics.repository';
import { eventsRepository } from '@/src/db/repositories/events.repository';
import { taskManager } from '@/src/orchestrator/taskManager';
import { checkTaskCompletion } from './taskCompletion';
import { cleanupCompletedTasks, cleanupStuckJobs } from './taskCleanup';

export class RunAgentProcessor extends BaseJobProcessor {
  type: JobType = 'run_agent';

  async process(job: Job): Promise<void> {
    const payload = job.payload as RunAgentJobPayload;

    if (!payload.agent_id) {
      throw new Error('agent_id is required in job payload');
    }

    // Load agent type
    const agentType = await agentRegistry.getAgent(payload.agent_id);
    if (!agentType) {
      throw new Error(`Agent ${payload.agent_id} not found`);
    }

    // Create agent instance (simplified - in production would use factory)
    let agent: any;
    switch (payload.agent_id) {
      case 'GoalRefiner':
        agent = new GoalRefinerAgent(agentType);
        break;
      case 'WeSpeaker':
        agent = new WeSpeakerAgent(agentType);
        break;
      case 'TaskPlanner':
        agent = new TaskPlannerAgent(agentType);
        break;
      case 'Judge':
        agent = new JudgeAgent(agentType);
        break;
      case 'Steward':
        agent = new StewardAgent(agentType);
        break;
      case 'ModelEvaluator':
        agent = new ModelEvaluatorAgent(agentType);
        break;
      case 'ConsensusAgent':
        agent = new ConsensusAgent(agentType);
        break;
      case 'ArchitectureEngineer':
        agent = new ArchitectureEngineerAgent(agentType);
        break;
      case 'MemoryCurator':
        agent = new MemoryCuratorAgent(agentType);
        break;
      case 'Worker':
        agent = new WorkerAgent(agentType);
        break;
      case 'ResearchWorker':
        agent = new ResearchWorkerAgent(agentType);
        break;
      case 'WritingWorker':
        agent = new WritingWorkerAgent(agentType);
        break;
      case 'AnalysisWorker':
        agent = new AnalysisWorkerAgent(agentType);
        break;
      default:
        throw new Error(`Unknown agent type: ${payload.agent_id}`);
    }

    // Execute agent
    const context = {
      agent_id: payload.agent_id,
      model_id: payload.model_id || '',
      input: payload.context || {},
      options: payload.options,
    };

    const output = await agent.execute(context);

    // Special handling for TaskPlanner - parse output and create tasks
    if (payload.agent_id === 'TaskPlanner' && payload.context?.goal_id) {
      await this.handleTaskPlannerOutput(output, payload.context.goal_id as string);
    }

    // Save agent output to blackboard if task_id provided
    if (payload.task_id) {
      try {
        const agentOutput = await blackboardService.createAgentOutput(
          output.agent_id,
          output.model_id,
          payload.task_id,
          output.output,
          output.metadata
        );

        // Schedule Judge to evaluate this output
        await jobQueue.createRunAgentJob(
          'Judge',
          {
            agent_output_id: agentOutput.id,
            agent_output: output.output,
            task_id: payload.task_id,
            agent_id: output.agent_id,
            web_enabled: payload.context?.web_enabled ?? false,
          }
        );

        // Check if all agents working on this task have completed
        const taskCompleted = await checkTaskCompletion(payload.task_id);
        
        if (!taskCompleted) {
          // Log that task is still pending (might be waiting for other agents)
          console.log(`Task ${payload.task_id} still pending - waiting for other agents or dependencies`);
        }
      } catch (error) {
        console.error(`Error saving agent output for task ${payload.task_id}:`, error);
        // Still try to check task completion even if output save failed
        try {
          await checkTaskCompletion(payload.task_id);
        } catch (checkError) {
          console.error(`Error checking task completion for ${payload.task_id}:`, checkError);
        }
      }
    }

    // Update agent metrics
    await agentMetricsRepository.incrementUsage(output.agent_id);
    if (output.latency_ms) {
      await agentMetricsRepository.updateMetrics(output.agent_id, {
        avg_latency_ms: output.latency_ms, // Simplified - should calculate moving average
      });
    }

    // Log event
    await eventsRepository.create({
      type: 'agent_run',
      agent_id: output.agent_id,
      model_id: output.model_id,
      blackboard_item_id: payload.task_id || null,
      job_id: job.id,
      data: {
        latency_ms: output.latency_ms,
        input_summary: output.input_summary,
        output_length: output.output.length,
      },
    });

    // If WeSpeaker completed a task completion response, clean up completed tasks
    if (payload.agent_id === 'WeSpeaker' && payload.context?.cleanup_after && payload.context?.goal_id) {
      // Wait a bit to ensure the response is saved
      setTimeout(async () => {
        await cleanupCompletedTasks(payload.context.goal_id);
      }, 2000);
    }
  }

  private async handleTaskPlannerOutput(output: any, goalId: string): Promise<void> {
    // Parse TaskPlanner output and create tasks
    // The output can be in various formats: tables, numbered lists, bullet points
    
    const taskText = (output.output || '').trim();
    const tasks: Array<{ summary: string; priority: string; agent_count: number; task_type: string; dependencies: number[] }> = [];

    const tryParseJsonTasks = () => {
      if (taskText.length === 0) {
        return;
      }

      const firstBrace = taskText.indexOf('{');
      const lastBrace = taskText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return;
      }

      try {
        const jsonString = taskText.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonString);
        if (!parsed || !Array.isArray(parsed.tasks)) {
          return;
        }

        for (const rawTask of parsed.tasks) {
          if (!rawTask) continue;
          const summary = (rawTask.summary || rawTask.description || '').trim();
          if (summary.length < 10) continue; // Require at least 10 chars
          
          // Filter out explanation text, headers, and non-actionable fragments
          const summaryLower = summary.toLowerCase();
          if (
            summaryLower.startsWith('priority') ||
            summaryLower.startsWith('task ') && summaryLower.includes('are') ||
            summaryLower.includes('rationale') ||
            summaryLower.includes('can be deferred') ||
            summaryLower.includes('can run concurrently') ||
            summaryLower.includes('final checks') ||
            summaryLower.includes('parallel tasks') ||
            summaryLower.includes('enhance quality') ||
            summaryLower.includes('essential for') ||
            summaryLower.match(/^[a-z\s]+:$/) || // Headers like "Priority Rationale:"
            summary.length < 20 && !summaryLower.match(/\b(create|find|research|write|build|develop|design|plan|organize|prepare|gather|collect|analyze|evaluate|implement|execute|complete|finish)\b/i)
          ) {
            console.log(`Skipping invalid task fragment: "${summary}"`);
            continue;
          }

          const priorityLower = (rawTask.priority || '').toString().toLowerCase();
          let taskPriority: 'high' | 'medium' | 'low' = 'medium';
          if (priorityLower.includes('high')) taskPriority = 'high';
          else if (priorityLower.includes('low')) taskPriority = 'low';

          let agentCount = parseInt(rawTask.agent_count, 10);
          if (Number.isNaN(agentCount)) agentCount = 1;
          agentCount = Math.min(Math.max(agentCount, 1), 5);

          let cleanTaskType = (rawTask.task_type || 'general').toString().toLowerCase().trim();
          if (!cleanTaskType) cleanTaskType = 'general';

          const dependencies = Array.isArray(rawTask.dependencies)
            ? rawTask.dependencies
                .map((dep: any) => parseInt(dep, 10))
                .filter((dep: number) => Number.isInteger(dep) && dep > 0)
            : [];

          tasks.push({
            summary: summary.substring(0, 500),
            priority: taskPriority,
            agent_count: agentCount,
            task_type: cleanTaskType,
            dependencies,
          });
        }
      } catch (error) {
        console.error('Failed to parse TaskPlanner JSON output:', error);
      }
    };

    tryParseJsonTasks();
    
    if (tasks.length === 0) {
      // First, try to parse markdown tables
      // Look for table rows with format: | # | Description | Priority | Agent Count | Task Type | ...
      const lines = taskText.split('\n');
      const seenTasks = new Set<string>();
      let inTable = false;
      let headerFound = false;
      let columnMap: Record<string, number> = {}; // Map column names to indices
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect table start (header row with "Description" or "| # |")
        if (trimmed.includes('|') && (trimmed.toLowerCase().includes('description') || trimmed.match(/\|\s*#\s*\|/))) {
          inTable = true;
          headerFound = true;
          // Parse header to map column names
          const headerCols = trimmed.split('|').map(col => col.trim().toLowerCase()).filter(col => col.length > 0);
          headerCols.forEach((col, idx) => {
            if (col.includes('description')) columnMap.description = idx;
            if (col.includes('priority')) columnMap.priority = idx;
            if (col.includes('agent') || col.includes('count')) columnMap.agent_count = idx;
            if (col.includes('type') || col.includes('task type')) columnMap.task_type = idx;
            if (col.includes('depend')) columnMap.dependencies = idx;
            if (col === '#' || col.match(/^\d+$/)) columnMap.number = idx;
          });
          continue;
        }
        
        // Skip separator rows (|---|---|)
        if (inTable && trimmed.match(/^\|[\s\-:]+\|/)) {
          continue;
        }
        
        // Process table rows
        if (inTable && headerFound && trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // Split by pipe and extract columns
          const columns = trimmed.split('|').map(col => col.trim()).filter(col => col.length > 0);
          
          // Need at least 3 columns: #, Description, Priority
          if (columns.length >= 3) {
            const taskNum = columns[columnMap.number ?? 0];
            const description = columns[columnMap.description ?? 1] || '';
            const priority = columns[columnMap.priority ?? 2] || 'medium';
            const agentCountStr = columns[columnMap.agent_count ?? 3] || '1';
            const taskType = columns[columnMap.task_type ?? 4] || 'general';
            const dependenciesStr = columns[columnMap.dependencies ?? 5] || '';
            
            // Skip if not a number (header or invalid row)
            if (!/^\d+$/.test(taskNum)) {
              continue;
            }
            
            // Skip if description is too short or is a header
            if (description.length < 10 || 
                description.toLowerCase().includes('description') ||
                description.includes('---')) {
              continue;
            }
            
            // Clean up markdown formatting
            let cleanDesc = description
              .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
              .replace(/\*(.+?)\*/g, '$1') // Remove italic
              .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
              .replace(/`(.+?)`/g, '$1') // Remove code
              .trim();
            
            // Extract priority from the priority column
            let taskPriority = 'medium';
            const priorityLower = priority.toLowerCase();
            if (priorityLower.includes('high')) {
              taskPriority = 'high';
            } else if (priorityLower.includes('low')) {
              taskPriority = 'low';
            }
            
            // Extract agent count (default to 1)
            let agentCount = 1;
            const agentCountMatch = agentCountStr.match(/\d+/);
            if (agentCountMatch) {
              agentCount = Math.min(Math.max(1, parseInt(agentCountMatch[0])), 5); // Clamp between 1-5
            }
            
            // Extract dependencies (parse task numbers from dependencies column)
            const dependencies: number[] = [];
            if (dependenciesStr && dependenciesStr.trim() && dependenciesStr !== '-') {
              // Extract task numbers (e.g., "Task 4, Task 5" or "4, 5" or "Tasks 4–5")
              const depMatches = dependenciesStr.match(/\d+/g);
              if (depMatches) {
                dependencies.push(...depMatches.map(n => parseInt(n)));
              }
            }
            
            // Extract task type
            let cleanTaskType = taskType.toLowerCase().trim();
            if (!cleanTaskType || cleanTaskType === 'general' || cleanTaskType === '-') {
              // Infer from description
              if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
                cleanTaskType = 'research';
              } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
                cleanTaskType = 'writing';
              } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
                cleanTaskType = 'analysis';
              } else {
                cleanTaskType = 'general';
              }
            }
            
            // Filter out explanation text, headers, and non-actionable fragments
            const descLower = cleanDesc.toLowerCase();
            if (
              descLower.startsWith('priority') ||
              descLower.startsWith('task ') && descLower.includes('are') ||
              descLower.includes('rationale') ||
              descLower.includes('can be deferred') ||
              descLower.includes('can run concurrently') ||
              descLower.includes('final checks') ||
              descLower.includes('parallel tasks') ||
              descLower.includes('enhance quality') ||
              descLower.includes('essential for') ||
              descLower.match(/^[a-z\s]+:$/) || // Headers like "Priority Rationale:"
              cleanDesc.length < 20 || // Too short to be a real task
              !descLower.match(/\b(create|find|research|write|build|develop|design|plan|organize|prepare|gather|collect|analyze|evaluate|implement|execute|complete|finish|identify|recommend|provide|list|outline|draft|compile|verify|check|confirm)\b/i) // Must contain action verb
            ) {
              console.log(`Skipping invalid task fragment: "${cleanDesc}"`);
              continue;
            }
            
            // Create a unique key to avoid duplicates
            const taskKey = cleanDesc.substring(0, 100).toLowerCase();
            if (cleanDesc.length >= 20 && cleanDesc.length < 500 && !seenTasks.has(taskKey)) {
              seenTasks.add(taskKey);
              tasks.push({
                summary: cleanDesc.substring(0, 500),
                priority: taskPriority,
                agent_count: agentCount,
                task_type: cleanTaskType,
                dependencies: dependencies,
              });
            }
          }
        } else if (inTable && trimmed.length > 0 && !trimmed.startsWith('|')) {
          // End of table
          inTable = false;
        }
      }
    }

    // If no table found, try numbered list format: "1. Task description" or "| 1 | Description |"
    if (tasks.length === 0) {
      // Pattern for numbered lists with optional markdown formatting
      const numberedListPattern = /(?:^|\n)\s*(?:\d+\.|\|\s*\d+\s*\|)\s*\*\*(.+?)\*\*\s*[–-]\s*(.+?)(?=\n|$)/g;
      let listMatch;
      while ((listMatch = numberedListPattern.exec(taskText)) !== null) {
        const taskTitle = listMatch[1]?.trim();
        const taskDesc = listMatch[2]?.trim();
        const fullDescription = taskTitle && taskDesc 
          ? `${taskTitle}: ${taskDesc}`
          : taskDesc || taskTitle || '';
        
        if (fullDescription.length > 10) {
          tasks.push({
            summary: fullDescription.substring(0, 500),
            priority: 'medium',
            agent_count: 1,
            task_type: 'general',
            dependencies: [],
          });
        }
      }
    }

    // If still no tasks, try simple numbered list: "1. Description"
    if (tasks.length === 0) {
      const simpleNumberedPattern = /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|$)/gs;
      let simpleMatch;
      while ((simpleMatch = simpleNumberedPattern.exec(taskText)) !== null) {
        const taskDesc = simpleMatch[2]?.trim();
        // Remove markdown formatting
        const cleanDesc = taskDesc
          .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.+?)\*/g, '$1') // Remove italic
          .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
          .trim();
        
        // Infer task type from description
        let taskType = 'general';
        if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
          taskType = 'research';
        } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
          taskType = 'writing';
        } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
          taskType = 'analysis';
        }
        
        if (cleanDesc.length > 10 && cleanDesc.length < 500) {
          tasks.push({
            summary: cleanDesc,
            priority: 'medium',
            agent_count: 1,
            task_type: taskType,
            dependencies: [],
          });
        }
      }
    }

    // If still no tasks, try bullet points
    if (tasks.length === 0) {
      const bulletPattern = /(?:^|\n)\s*[-*]\s+(.+?)(?=\n\s*[-*]|$)/g;
      let bulletMatch;
      while ((bulletMatch = bulletPattern.exec(taskText)) !== null) {
        const taskDesc = bulletMatch[1]?.trim();
        const cleanDesc = taskDesc
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .trim();
        
        // Infer task type from description
        let taskType = 'general';
        if (cleanDesc.toLowerCase().match(/\b(research|find|gather|search|look up|investigate)\b/)) {
          taskType = 'research';
        } else if (cleanDesc.toLowerCase().match(/\b(write|draft|create|compose|document)\b/)) {
          taskType = 'writing';
        } else if (cleanDesc.toLowerCase().match(/\b(analyze|evaluate|assess|examine|review)\b/)) {
          taskType = 'analysis';
        }
        
        if (cleanDesc.length > 10 && cleanDesc.length < 500) {
          tasks.push({
            summary: cleanDesc,
            priority: 'medium',
            agent_count: 1,
            task_type: taskType,
            dependencies: [],
          });
        }
      }
    }

    const goal = await blackboardService.findById(goalId);
    const webEnabled = goal?.dimensions?.web_enabled ?? false;

    // Create tasks in the blackboard with dependencies
    // First pass: create all tasks and map task numbers to IDs
    const taskNumberToId = new Map<number, string>();
    const taskDependencyMap = new Map<number, number[]>();
    const createdTaskIds: string[] = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskNumber = i + 1; // Task numbers are 1-indexed
      
      if (!task.summary.trim()) {
        continue;
      }
      
      try {
        const taskItem = await taskManager.createTask(
          task.summary,
          goalId,
          {
            status: 'pending',
            priority: task.priority,
            source: 'taskplanner',
            agent_count: task.agent_count,
            task_type: task.task_type,
            dependencies: [],
            dependency_task_numbers: task.dependencies,
            task_number: taskNumber, // Store task number for dependency resolution
            web_enabled: webEnabled,
          },
          { autoAssign: false }
        );
        
        const taskId = taskItem.id;
        taskNumberToId.set(taskNumber, taskId);
        taskDependencyMap.set(taskNumber, task.dependencies);
        createdTaskIds.push(taskId);

      } catch (error) {
        console.error(`Error creating task from TaskPlanner output:`, error);
      }
    }
    
    // Second pass: resolve dependencies (convert task numbers to task IDs)
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskNumber = i + 1;
      const taskId = taskNumberToId.get(taskNumber);
      
      if (!taskId) {
        continue;
      }

      const dependencyNumbers = taskDependencyMap.get(taskNumber) || [];

      if (dependencyNumbers.length > 0) {
        // Resolve dependency task numbers to task IDs
        const dependencyTaskIds = dependencyNumbers
          .map(depNum => taskNumberToId.get(depNum))
          .filter(Boolean) as string[];
        
        if (dependencyTaskIds.length > 0) {
          // Update task with resolved dependency IDs
        const existingTask = await blackboardService.findById(taskId);
          await blackboardService.update(taskId, {
            dimensions: {
              ...(existingTask?.dimensions || {}),
              dependencies: dependencyTaskIds,
              dependency_task_numbers: dependencyNumbers, // Keep numbers for reference
            },
          });
        }
      }

      // Attempt to assign the task now that dependencies are resolved (if any)
      await taskManager.assignAgentToTask(taskId);
    }

    // Also save the full output as agent output for reference
    await blackboardService.createAgentOutput(
      output.agent_id,
      output.model_id,
      goalId,
      output.output,
      output.metadata
    );
  }
}

