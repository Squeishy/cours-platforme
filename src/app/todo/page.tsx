import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { StaffTodo } from "./_components/staff-todo";
import { StudentTodo } from "./_components/student-todo";

export const metadata: Metadata = { title: "À faire" };

export default async function TodoPage() {
  const user = await requireUser();
  const staff = isStaff(user);
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            {staff ? "Équipe pédagogique" : "Mon planning"} · <time dateTime={now.toISOString()}>{formatDate(now)}</time>
          </>
        }
        title="À faire"
        lead={
          staff
            ? "Ce qui attend votre action sur les SAÉ que vous gérez et sur vos cours."
            : "Vos jalons, dépôts, auto-évaluations et soutenances, du plus urgent au plus lointain."
        }
        actions={
          <Link href="/me/settings#calendrier" className="btn">
            Ajouter à mon agenda
          </Link>
        }
      />

      {staff ? <StaffTodo userId={user.id} now={now} /> : <StudentTodo userId={user.id} now={now} />}
    </div>
  );
}
