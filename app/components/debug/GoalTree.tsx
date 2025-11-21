'use client';

interface GoalTreeNode {
  id: string;
  type: 'goal' | 'task' | 'user_request';
  summary: string;
  status?: string;
  children?: GoalTreeNode[];
}

interface GoalTreeProps {
  root: GoalTreeNode;
}

export default function GoalTree({ root }: GoalTreeProps) {
  const renderNode = (node: GoalTreeNode, level: number = 0) => {
    const indent = level * 20;
    const statusColor = 
      node.status === 'completed' ? 'text-green-600' :
      node.status === 'open' ? 'text-blue-600' :
      node.status === 'failed' ? 'text-red-600' :
      'text-gray-600';

    return (
      <div key={node.id} style={{ marginLeft: `${indent}px` }} className="mb-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs">{'└─'}</span>
          <span className="text-sm font-medium">{node.type}</span>
          {node.status && (
            <span className={`text-xs ${statusColor}`}>({node.status})</span>
          )}
        </div>
        <div className="text-sm text-gray-700 ml-6">{node.summary}</div>
        {node.children && node.children.length > 0 && (
          <div className="mt-1">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Goal/Task Tree</h3>
      <div className="border rounded p-3 bg-gray-50">
        {renderNode(root)}
      </div>
    </div>
  );
}

