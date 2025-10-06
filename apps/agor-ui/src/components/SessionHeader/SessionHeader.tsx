import {
  BranchesOutlined,
  ForkOutlined,
  LoadingOutlined,
  MessageOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Badge, Space, Spin, Tag, Typography } from 'antd';
import type { Session } from '../../types';
import './SessionHeader.css';

const { Text } = Typography;

interface SessionHeaderProps {
  session: Session;
  onClick?: () => void;
  showCounts?: boolean;
}

const SessionHeader = ({ session, onClick, showCounts = true }: SessionHeaderProps) => {
  const getStatusColor = () => {
    switch (session.status) {
      case 'running':
        return 'processing';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getAgentIcon = () => {
    const agentIcons: Record<string, string> = {
      'claude-code': '🤖',
      cursor: '✏️',
      codex: '💻',
      gemini: '💎',
    };
    return agentIcons[session.agent] || '🤖';
  };

  const isForked = !!session.genealogy.forked_from_session_id;
  const isSpawned = !!session.genealogy.parent_session_id;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: UI prototype - keyboard events will be added in production
    // biome-ignore lint/a11y/noStaticElementInteractions: UI prototype - proper semantics will be added in production
    <div className={`session-header-component ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="header-main">
        <Space size={8} align="center">
          <span className="agent-icon">{getAgentIcon()}</span>
          <Text strong className="agent-name">
            {session.agent}
          </Text>
          {session.status === 'running' ? (
            <Spin indicator={<LoadingOutlined spin style={{ fontSize: 12 }} />} />
          ) : (
            <Badge status={getStatusColor()} text={session.status.toUpperCase()} />
          )}
        </Space>

        <Space size={4}>
          {isForked && (
            <Tag icon={<ForkOutlined />} color="cyan" className="genealogy-tag">
              FORK
            </Tag>
          )}
          {isSpawned && (
            <Tag icon={<BranchesOutlined />} color="purple" className="genealogy-tag">
              SPAWN
            </Tag>
          )}
        </Space>
      </div>

      {session.description && (
        <Text className="session-title" ellipsis={{ tooltip: session.description }}>
          {session.description}
        </Text>
      )}

      {showCounts && (
        <Space size={12} className="session-counts">
          <Text type="secondary" className="count-item">
            📋 {session.tasks.length}
          </Text>
          <Text type="secondary" className="count-item">
            <MessageOutlined /> {session.message_count}
          </Text>
          <Text type="secondary" className="count-item">
            <ToolOutlined /> {session.tool_use_count}
          </Text>
        </Space>
      )}
    </div>
  );
};

export default SessionHeader;
