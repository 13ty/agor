import type { Meta, StoryObj } from '@storybook/react';
import { Button, ConfigProvider, theme } from 'antd';
import { useState } from 'react';
import { mockAgents } from '../../mocks';
import { NewSessionModal } from './NewSessionModal';

const meta = {
  title: 'Components/NewSessionModal',
  component: NewSessionModal,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <Story />
      </ConfigProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof NewSessionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// biome-ignore lint/suspicious/noExplicitAny: Storybook args type is dynamic
const ModalWrapper = ({ args }: { args: any }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Open Modal
      </Button>
      <NewSessionModal
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        onCreate={config => {
          console.log('Created session with config:', config);
          alert(`Created session with agent: ${config.agent}`);
          setOpen(false);
        }}
      />
    </>
  );
};

export const Default: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents,
  },
};

export const AllAgentsInstalled: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents.map(agent => ({ ...agent, installed: true })),
  },
};

export const NoAgentsInstalled: Story = {
  render: args => <ModalWrapper args={args} />,
  args: {
    availableAgents: mockAgents.map(agent => ({ ...agent, installed: false })),
  },
};

export const OpenByDefault: Story = {
  args: {
    open: true,
    onClose: () => console.log('Close modal'),
    onCreate: config => console.log('Created session:', config),
    availableAgents: mockAgents,
  },
};

export const WithInitialPrompt: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <NewSessionModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={config => {
          console.log('Created session:', config);
          setOpen(false);
        }}
        availableAgents={mockAgents}
      />
    );
  },
};
