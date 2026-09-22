import { toInputDate } from "../_lib/dates";

export type CourseOption = { id: string; title: string };

type Props = {
  /** Préfixe des id HTML (plusieurs formulaires sur une page) */
  idPrefix: string;
  courses: CourseOption[];
  defaults?: {
    code: string | null;
    title: string;
    semester: number | null;
    competences: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    courseId: string | null;
  };
};

const SEMESTERS = [1, 2, 3, 4, 5, 6] as const;

/** Champs communs à la création et aux réglages d'une SAÉ */
export function SaeFields({ idPrefix, courses, defaults }: Props) {
  const f = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor={f("code")} className="label">
          Code <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <input
          id={f("code")}
          name="code"
          className="input"
          maxLength={40}
          placeholder="SAÉ 2.01"
          defaultValue={defaults?.code ?? ""}
        />
      </div>
      <div>
        <label htmlFor={f("semester")} className="label">
          Semestre
        </label>
        <select id={f("semester")} name="semester" className="input" defaultValue={defaults?.semester ?? ""}>
          <option value="">Non précisé</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              Semestre {s}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("title")} className="label">
          Titre
        </label>
        <input
          id={f("title")}
          name="title"
          className="input"
          required
          maxLength={200}
          defaultValue={defaults?.title ?? ""}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("competences")} className="label">
          Compétences visées <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <textarea
          id={f("competences")}
          name="competences"
          className="input py-2"
          rows={2}
          maxLength={2000}
          placeholder="C1 Réaliser, C2 Optimiser"
          defaultValue={defaults?.competences ?? ""}
        />
      </div>
      <div>
        <label htmlFor={f("startsAt")} className="label">
          Début
        </label>
        <input
          id={f("startsAt")}
          name="startsAt"
          type="date"
          className="input"
          defaultValue={toInputDate(defaults?.startsAt)}
        />
      </div>
      <div>
        <label htmlFor={f("endsAt")} className="label">
          Fin
        </label>
        <input id={f("endsAt")} name="endsAt" type="date" className="input" defaultValue={toInputDate(defaults?.endsAt)} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor={f("courseId")} className="label">
          Cours lié <span className="font-normal text-muted">(optionnel)</span>
        </label>
        <select id={f("courseId")} name="courseId" className="input" defaultValue={defaults?.courseId ?? ""}>
          <option value="">Aucun cours</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {courses.length === 0 && (
          <p className="mt-1 text-sm text-muted">Aucun cours que vous pouvez modifier pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
