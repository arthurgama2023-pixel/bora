import { redirect } from "next/navigation";
import Editor from "@/components/editor/Editor";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) redirect("/login");
  const { id } = await params;
  return <Editor id={id} />;
}
