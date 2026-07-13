import { redirect } from "next/navigation";
import ProjectView from "@/components/ProjectView";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) redirect("/login");
  const { id } = await params;
  return <ProjectView id={id} />;
}
