import { ChatView } from "@/components/chat/chat-view";
import { MetricsPanel } from "@/components/metrics-panel";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <ChatView />
      <MetricsPanel />
    </div>
  );
}
