import { ChatView } from "@/components/chat/chat-view";
import { MetricsPanel } from "@/components/metrics-panel";

// Next 16: params assíncrono também em páginas.
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <ChatView conversationId={id} />
      <MetricsPanel />
    </div>
  );
}
