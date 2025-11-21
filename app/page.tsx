export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>AutoAgent - LLM Hive System</h1>
      <p>API is running. Use the API routes to interact with the system.</p>
      <ul>
        <li>POST /api/conversation - Send a message</li>
        <li>POST /api/stream - Stream a response</li>
        <li>GET /api/blackboard - Query blackboard items</li>
        <li>GET /api/agents - List agents</li>
        <li>GET /api/models - List models</li>
        <li>GET /api/health - Health check</li>
      </ul>
    </main>
  );
}

