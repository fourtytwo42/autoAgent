#!/usr/bin/env tsx

/**
 * End-to-end test script for the autoAgent system
 * Tests the complete flow: user request -> goal refinement -> task planning -> task execution -> final response
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TEST_MESSAGE = "I need an itinaray, hotel and dispensary recomendations. I am going to be in denver for a week. I am from illinois. leaving on feb 16th coming home on feb 22nd";

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  console.log(`[API] ${options.method || 'GET'} ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error(`[API] Error calling ${endpoint}:`, error);
    throw error;
  }
}

async function sendUserMessage(message: string): Promise<string> {
  console.log('\n=== STEP 1: Sending User Message ===');
  console.log(`Message: "${message}"`);
  
  try {
    const response = await fetch(`${API_BASE}/api/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to send message: ${error.error || error.message}`);
    }
    
    // Handle streaming response
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponse = '';
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'response') {
                finalResponse = data.response;
                console.log(`[WeSpeaker] Initial response: "${finalResponse.substring(0, 100)}..."`);
                return finalResponse;
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      return finalResponse || 'Response received';
    } else {
      const data = await response.json();
      return data.response || 'Response received';
    }
  } catch (error) {
    console.error('[ERROR] Failed to send user message:', error);
    throw error;
  }
}

async function waitForGoal(maxWaitSeconds: number = 30): Promise<string> {
  console.log('\n=== STEP 2: Waiting for Goal Creation ===');
  const startTime = Date.now();
  const maxWait = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWait) {
    const goals = await apiCall('/api/blackboard?type=goal&limit=1');
    if (goals.items && goals.items.length > 0) {
      const goal = goals.items[0];
      console.log(`[✓] Goal created: ${goal.id}`);
      console.log(`   Summary: "${goal.summary.substring(0, 100)}..."`);
      return goal.id;
    }
    
    await sleep(1000);
    process.stdout.write('.');
  }
  
  throw new Error('Timeout waiting for goal creation');
}

async function waitForTasks(goalId: string, maxWaitSeconds: number = 60): Promise<string[]> {
  console.log('\n=== STEP 3: Waiting for Tasks Creation ===');
  const startTime = Date.now();
  const maxWait = maxWaitSeconds * 1000;
  let lastCount = 0;
  
  while (Date.now() - startTime < maxWait) {
    const tasks = await apiCall(`/api/blackboard?type=task&limit=100`);
    const taskItems = tasks.items || [];
    
    if (taskItems.length > lastCount) {
      console.log(`[✓] Found ${taskItems.length} tasks`);
      lastCount = taskItems.length;
    }
    
    // Wait a bit more to ensure all tasks are created
    if (taskItems.length > 0) {
      await sleep(3000); // Give TaskPlanner time to finish
      const finalTasks = await apiCall(`/api/blackboard?type=task&limit=100`);
      const finalTaskItems = finalTasks.items || [];
      console.log(`[✓] Final task count: ${finalTaskItems.length}`);
      
      return finalTaskItems.map((t: any) => t.id);
    }
    
    await sleep(2000);
    process.stdout.write('.');
  }
  
  throw new Error('Timeout waiting for task creation');
}

async function waitForTaskCompletion(taskIds: string[], maxWaitSeconds: number = 300): Promise<void> {
  console.log('\n=== STEP 4: Waiting for Task Completion ===');
  const startTime = Date.now();
  const maxWait = maxWaitSeconds * 1000;
  const completedTasks = new Set<string>();
  
  while (Date.now() - startTime < maxWait) {
    for (const taskId of taskIds) {
      if (completedTasks.has(taskId)) continue;
      
      const task = await apiCall(`/api/blackboard?id=${taskId}`);
      const status = task.item?.dimensions?.status;
      
      if (status === 'completed') {
        if (!completedTasks.has(taskId)) {
          console.log(`[✓] Task ${taskId.substring(0, 8)}... completed: "${task.item.summary.substring(0, 60)}..."`);
          completedTasks.add(taskId);
        }
      }
    }
    
    if (completedTasks.size === taskIds.length) {
      console.log(`[✓] All ${taskIds.length} tasks completed!`);
      return;
    }
    
    const remaining = taskIds.length - completedTasks.size;
    process.stdout.write(`\r[WAITING] ${completedTasks.size}/${taskIds.length} tasks completed (${remaining} remaining)...`);
    await sleep(3000);
  }
  
  const incomplete = taskIds.filter(id => !completedTasks.has(id));
  throw new Error(`Timeout: ${incomplete.length} tasks not completed: ${incomplete.map(id => id.substring(0, 8)).join(', ')}`);
}

async function waitForWeSpeakerFinalResponse(maxWaitSeconds: number = 120): Promise<string> {
  console.log('\n=== STEP 5: Waiting for WeSpeaker Final Response ===');
  const startTime = Date.now();
  const maxWait = maxWaitSeconds * 1000;
  let lastMessageCount = 0;
  
  while (Date.now() - startTime < maxWait) {
    const conversation = await apiCall('/api/conversation');
    const messages = conversation.messages || [];
    
    // Look for WeSpeaker messages (assistant role)
    const weSpeakerMessages = messages.filter((m: any) => m.role === 'assistant');
    
    if (weSpeakerMessages.length > lastMessageCount) {
      const latestMessage = weSpeakerMessages[weSpeakerMessages.length - 1];
      console.log(`[✓] WeSpeaker response received (${weSpeakerMessages.length} total messages)`);
      console.log(`   Content: "${latestMessage.content.substring(0, 200)}..."`);
      return latestMessage.content;
    }
    
    lastMessageCount = weSpeakerMessages.length;
    await sleep(3000);
    process.stdout.write('.');
  }
  
  throw new Error('Timeout waiting for WeSpeaker final response');
}

async function checkSystemHealth(): Promise<void> {
  console.log('\n=== Checking System Health ===');
  
  try {
    const health = await apiCall('/api/health');
    console.log(`[✓] System health: ${health.status}`);
    console.log(`   Database: ${health.database}`);
    console.log(`   Models: ${health.models.enabled} enabled`);
    console.log(`   Agents: ${health.agents.enabled} enabled`);
    console.log(`   Jobs: ${health.jobs.pending} pending, ${health.jobs.running} running`);
  } catch (error) {
    console.error('[WARNING] Health check failed:', error);
  }
}

async function main() {
  console.log('========================================');
  console.log('  autoAgent End-to-End Test Script');
  console.log('========================================\n');
  
  try {
    // Check system health
    await checkSystemHealth();
    
    // Step 1: Send user message
    const initialResponse = await sendUserMessage(TEST_MESSAGE);
    console.log(`[✓] Initial WeSpeaker response received`);
    
    // Step 2: Wait for goal
    const goalId = await waitForGoal(30);
    
    // Step 3: Wait for tasks
    const taskIds = await waitForTasks(goalId, 60);
    console.log(`[✓] ${taskIds.length} tasks created`);
    
    // List tasks
    console.log('\n=== Task List ===');
    for (const taskId of taskIds) {
      const task = await apiCall(`/api/blackboard?id=${taskId}`);
      console.log(`  - ${task.item.summary.substring(0, 80)}...`);
    }
    
    // Step 4: Wait for task completion
    await waitForTaskCompletion(taskIds, 300);
    
    // Step 5: Wait for WeSpeaker final response
    const finalResponse = await waitForWeSpeakerFinalResponse(120);
    
    console.log('\n========================================');
    console.log('  ✓ END-TO-END TEST COMPLETED');
    console.log('========================================');
    console.log(`\nFinal WeSpeaker Response:\n${finalResponse.substring(0, 500)}...`);
    
  } catch (error) {
    console.error('\n========================================');
    console.error('  ✗ END-TO-END TEST FAILED');
    console.error('========================================');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);

