"use client";

import { useCallback, useMemo, useState } from "react";
import {
  anomalyTypeLabels,
  anomalyTypes,
  diagnosisSteps,
  evidenceChecklists,
  type AnomalyType,
  type Confirmation,
  type Diagnosis,
  type DiagnosisDraft,
} from "@/src/features/diagnoses/model";
import { useAutosave } from "./use-autosave";

const confirmationLabels: Record<Exclude<Confirmation, "">, string> = {
  yes: "是",
  partly: "部分确认",
  no: "否",
};

function isDiagnosis(value: unknown): value is Diagnosis {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "status" in value && (value.status === "ongoing" || value.status === "completed") &&
    "updatedAt" in value && typeof value.updatedAt === "string";
}

function DiagnosisSummary({ diagnosis }: Readonly<{ diagnosis: Diagnosis }>) {
  return (
    <article className="diagnosis-summary">
      <header>
        <div>
          <p className="diagnosis-eyebrow">{anomalyTypeLabels[diagnosis.anomalyType]}</p>
          <h3>{diagnosis.name}</h3>
        </div>
        <span>已完成</span>
      </header>
      <dl>
        <div>
          <dt>问题</dt>
          <dd>{diagnosis.confirmedProblem}</dd>
        </div>
        <div>
          <dt>证据</dt>
          <dd>
            <p>{diagnosis.anomalyFact}</p>
            <p>{diagnosis.evidenceChecks.join("、")}</p>
            <p>{diagnosis.evidenceNotes}</p>
          </dd>
        </div>
        <div>
          <dt>判断</dt>
          <dd>
            <p>{diagnosis.primaryJudgment}</p>
            <p>验证：{confirmationLabels[diagnosis.judgmentConfirmed as Exclude<Confirmation, "">]}</p>
          </dd>
        </div>
        <div>
          <dt>动作</dt>
          <dd>
            <p>{diagnosis.action}</p>
            <p>{diagnosis.responsible} · {diagnosis.validationMetric} · {diagnosis.reviewDate}</p>
          </dd>
        </div>
        <div>
          <dt>结果</dt>
          <dd>
            <p>是否改善：{confirmationLabels[diagnosis.resultImproved as Exclude<Confirmation, "">]}</p>
            <p>有效：{diagnosis.effectiveAction}</p>
            <p>无效：{diagnosis.ineffectiveAction}</p>
            <p>下次优先检查：{diagnosis.nextCheck}</p>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function NewDiagnosisForm({ onCreated }: Readonly<{ onCreated: (diagnosis: Diagnosis) => void }>) {
  const [name, setName] = useState("");
  const [anomalyType, setAnomalyType] = useState<AnomalyType>("homework");
  const [anomalyFact, setAnomalyFact] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    try {
      const response = await fetch("/api/diagnoses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, anomalyType, anomalyFact }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isDiagnosis(payload)) throw new Error("diagnosis_not_created");
      setName("");
      setAnomalyFact("");
      setState("idle");
      onCreated(payload);
    } catch {
      setState("error");
    }
  }

  return (
    <details className="diagnosis-create">
      <summary>新建诊断案例</summary>
      <form onSubmit={submit}>
        <label htmlFor="diagnosis-name">老师或案例名称</label>
        <input
          id="diagnosis-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          required
        />
        <label htmlFor="diagnosis-type">异常类型</label>
        <select
          id="diagnosis-type"
          value={anomalyType}
          onChange={(event) => setAnomalyType(event.target.value as AnomalyType)}
        >
          {anomalyTypes.map((type) => <option key={type} value={type}>{anomalyTypeLabels[type]}</option>)}
        </select>
        <label htmlFor="diagnosis-fact">已发现的异常事实</label>
        <textarea
          id="diagnosis-fact"
          value={anomalyFact}
          onChange={(event) => setAnomalyFact(event.target.value)}
          maxLength={10_000}
          required
        />
        <button type="submit" disabled={state === "saving"}>
          {state === "saving" ? "创建中…" : "创建并开始诊断"}
        </button>
        {state === "error" ? <p role="alert">创建失败，请检查内容后重试。</p> : null}
      </form>
    </details>
  );
}

function draftFrom(diagnosis: Diagnosis): DiagnosisDraft {
  return {
    status: diagnosis.status,
    currentStep: diagnosis.currentStep,
    changeFacts: diagnosis.changeFacts,
    evidenceChecks: diagnosis.evidenceChecks,
    evidenceNotes: diagnosis.evidenceNotes,
    primaryJudgment: diagnosis.primaryJudgment,
    alternativeExplanation: diagnosis.alternativeExplanation,
    falsifyingEvidence: diagnosis.falsifyingEvidence,
    validationFacts: diagnosis.validationFacts,
    judgmentConfirmed: diagnosis.judgmentConfirmed,
    teacherSupport: diagnosis.teacherSupport,
    confirmedProblem: diagnosis.confirmedProblem,
    action: diagnosis.action,
    responsible: diagnosis.responsible,
    validationMetric: diagnosis.validationMetric,
    reviewDate: diagnosis.reviewDate,
    resultImproved: diagnosis.resultImproved,
    effectiveAction: diagnosis.effectiveAction,
    ineffectiveAction: diagnosis.ineffectiveAction,
    nextCheck: diagnosis.nextCheck,
  };
}

function stepIsComplete(draft: DiagnosisDraft) {
  const filled = (...values: string[]) => values.every((value) => value.trim() !== "");
  switch (draft.currentStep) {
    case 1: return filled(draft.changeFacts);
    case 2: return draft.evidenceChecks.length > 0 && filled(draft.evidenceNotes);
    case 3: return filled(draft.primaryJudgment, draft.alternativeExplanation, draft.falsifyingEvidence);
    case 4: return draft.judgmentConfirmed !== "" && filled(draft.validationFacts, draft.teacherSupport);
    case 5: return filled(
      draft.confirmedProblem,
      draft.action,
      draft.responsible,
      draft.validationMetric,
      draft.reviewDate,
    );
    case 6: return draft.resultImproved !== "" && filled(
      draft.effectiveAction,
      draft.ineffectiveAction,
      draft.nextCheck,
    );
  }
}

function TextField({
  id,
  label,
  value,
  onChange,
  rows = 4,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}>) {
  return (
    <div className="diagnosis-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={10_000}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ChoiceField({
  legend,
  name,
  value,
  onChange,
}: Readonly<{
  legend: string;
  name: string;
  value: Confirmation;
  onChange: (value: Confirmation) => void;
}>) {
  return (
    <fieldset className="diagnosis-choices">
      <legend>{legend}</legend>
      {Object.entries(confirmationLabels).map(([option, label]) => (
        <label key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option as Confirmation)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function DiagnosisEditor({
  diagnosis,
  onSaved,
}: Readonly<{ diagnosis: Diagnosis; onSaved: (diagnosis: Diagnosis) => void }>) {
  const [draft, setDraft] = useState(() => draftFrom(diagnosis));
  const [validationError, setValidationError] = useState(false);
  const serialized = useMemo(() => JSON.stringify(draft), [draft]);
  const save = useCallback(async (nextValue: string, signal: AbortSignal) => {
    const nextDraft = JSON.parse(nextValue) as DiagnosisDraft;
    const response = await fetch("/api/diagnoses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: diagnosis.id, ...nextDraft }),
      signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok || !isDiagnosis(payload)) throw new Error("diagnosis_not_saved");
    onSaved(payload);
  }, [diagnosis.id, onSaved]);
  const { state, retry } = useAutosave(serialized, save);

  function update<K extends keyof DiagnosisDraft>(key: K, value: DiagnosisDraft[K]) {
    setValidationError(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function advance() {
    if (!stepIsComplete(draft)) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    setDraft((current) => current.currentStep === 6
      ? { ...current, status: "completed" }
      : { ...current, currentStep: current.currentStep + 1 });
  }

  if (draft.status === "completed") {
    return (
      <section className="diagnosis-editor" aria-label={`诊断案例：${diagnosis.name}`}>
        <DiagnosisSummary diagnosis={{ ...diagnosis, ...draft }} />
        {state === "saving" ? <p className="diagnosis-save" aria-live="polite">正在保存完成状态…</p> : null}
        {state === "error" ? (
          <div role="alert"><p>完成状态保存失败，请重试。</p><button type="button" onClick={retry}>重试保存</button></div>
        ) : null}
      </section>
    );
  }

  const step = draft.currentStep;
  return (
    <section className="diagnosis-editor" aria-label={`诊断案例：${diagnosis.name}`}>
      <header className="diagnosis-editor__header">
        <div>
          <p className="diagnosis-eyebrow">{anomalyTypeLabels[diagnosis.anomalyType]}</p>
          <h2>{diagnosis.name}</h2>
        </div>
        <p className="diagnosis-save" aria-live="polite">
          {state === "saving" ? "保存中…" : state === "saved" ? "已自动保存" : ""}
        </p>
      </header>
      <div className="diagnosis-original-fact">
        <strong>已发现的异常事实</strong>
        <p>{diagnosis.anomalyFact}</p>
      </div>
      <ol className="diagnosis-steps" aria-label="诊断进度">
        {diagnosisSteps.map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined}>
            <span>{index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <form className="diagnosis-step" onSubmit={(event) => { event.preventDefault(); advance(); }}>
        <p className="diagnosis-step__count">第 {step} / 6 步</p>
        {step === 1 ? (
          <>
            <h3>看变化</h3>
            <p>只记录发生了什么、何时发生、涉及谁，不评价老师。</p>
            <TextField id="change-facts" label="变化事实" value={draft.changeFacts} onChange={(value) => update("changeFacts", value)} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h3>查证据</h3>
            <p>逐项核查，勾选已查看的证据，并记录发现。</p>
            <fieldset className="diagnosis-checklist">
              <legend>固定检查清单</legend>
              {evidenceChecklists[diagnosis.anomalyType].map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={draft.evidenceChecks.includes(item)}
                    onChange={(event) => update(
                      "evidenceChecks",
                      event.target.checked
                        ? [...draft.evidenceChecks, item]
                        : draft.evidenceChecks.filter((checked) => checked !== item),
                    )}
                  />
                  {item}
                </label>
              ))}
            </fieldset>
            <TextField id="evidence-notes" label="证据与发现" value={draft.evidenceNotes} onChange={(value) => update("evidenceNotes", value)} />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <h3>作判断</h3>
            <TextField id="primary-judgment" label="主要判断" value={draft.primaryJudgment} onChange={(value) => update("primaryJudgment", value)} />
            <TextField id="alternative-explanation" label="一个备选解释" value={draft.alternativeExplanation} onChange={(value) => update("alternativeExplanation", value)} />
            <TextField id="falsifying-evidence" label="什么证据会推翻主要判断" value={draft.falsifyingEvidence} onChange={(value) => update("falsifyingEvidence", value)} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <h3>去验证</h3>
            <TextField id="validation-facts" label="沟通后新增事实" value={draft.validationFacts} onChange={(value) => update("validationFacts", value)} />
            <ChoiceField legend="原判断是否被确认" name={`judgment-${diagnosis.id}`} value={draft.judgmentConfirmed} onChange={(value) => update("judgmentConfirmed", value)} />
            <TextField id="teacher-support" label="老师需要什么支持" value={draft.teacherSupport} onChange={(value) => update("teacherSupport", value)} />
          </>
        ) : null}
        {step === 5 ? (
          <>
            <h3>定动作</h3>
            <TextField id="confirmed-problem" label="确认的问题" value={draft.confirmedProblem} onChange={(value) => update("confirmedProblem", value)} />
            <TextField id="diagnosis-action" label="具体动作" value={draft.action} onChange={(value) => update("action", value)} />
            <label htmlFor="responsible">负责人</label>
            <input id="responsible" value={draft.responsible} maxLength={200} onChange={(event) => update("responsible", event.target.value)} />
            <TextField id="validation-metric" label="验证指标" value={draft.validationMetric} onChange={(value) => update("validationMetric", value)} />
            <label htmlFor="review-date">复查日期</label>
            <input id="review-date" type="date" value={draft.reviewDate} onChange={(event) => update("reviewDate", event.target.value)} />
          </>
        ) : null}
        {step === 6 ? (
          <>
            <h3>看结果</h3>
            <ChoiceField legend="结果是否改善" name={`result-${diagnosis.id}`} value={draft.resultImproved} onChange={(value) => update("resultImproved", value)} />
            <TextField id="effective-action" label="有效动作" value={draft.effectiveAction} onChange={(value) => update("effectiveAction", value)} />
            <TextField id="ineffective-action" label="无效动作" value={draft.ineffectiveAction} onChange={(value) => update("ineffectiveAction", value)} />
            <TextField id="next-check" label="下次优先检查什么" value={draft.nextCheck} onChange={(value) => update("nextCheck", value)} />
          </>
        ) : null}

        {validationError ? <p role="alert">请完成本步全部内容后继续。</p> : null}
        {state === "error" ? (
          <div role="alert"><p>自动保存失败，内容仍保留在页面中。</p><button type="button" onClick={retry}>重试保存</button></div>
        ) : null}
        <div className="diagnosis-actions">
          {step > 1 ? <button type="button" className="button-secondary" onClick={() => update("currentStep", step - 1)}>上一步</button> : null}
          <button type="submit">{step === 6 ? "完成诊断" : "下一步"}</button>
        </div>
      </form>
    </section>
  );
}

export function DiagnosisWorkspace({ initialDiagnoses }: Readonly<{ initialDiagnoses: Diagnosis[] }>) {
  const [diagnoses, setDiagnoses] = useState(initialDiagnoses);
  const ongoing = diagnoses.filter((item) => item.status === "ongoing");
  const completed = diagnoses.filter((item) => item.status === "completed");
  const [selectedId, setSelectedId] = useState(ongoing[0]?.id ?? "");
  const selected = ongoing.find((item) => item.id === selectedId);

  const replace = useCallback((saved: Diagnosis) => {
    setDiagnoses((current) => current.map((item) => item.id === saved.id ? saved : item));
  }, []);

  function add(diagnosis: Diagnosis) {
    setDiagnoses((current) => [diagnosis, ...current]);
    setSelectedId(diagnosis.id);
  }

  return (
    <div className="diagnosis">
      <NewDiagnosisForm onCreated={add} />
      <section className="diagnosis-list" aria-labelledby="ongoing-diagnoses">
        <h2 id="ongoing-diagnoses">进行中</h2>
        {ongoing.length === 0 ? <p>暂无进行中的诊断案例。</p> : (
          <div className="diagnosis-list__items">
            {ongoing.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === selectedId}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.name}</span>
                <small>{anomalyTypeLabels[item.anomalyType]} · 第 {item.currentStep} 步</small>
              </button>
            ))}
          </div>
        )}
      </section>
      {selected ? <DiagnosisEditor key={selected.id} diagnosis={selected} onSaved={replace} /> : null}
      <section className="diagnosis-completed" aria-labelledby="completed-diagnoses">
        <h2 id="completed-diagnoses">已完成</h2>
        {completed.length === 0 ? <p>完成六步后，摘要卡会显示在这里。</p> : completed.map((item) => (
          <DiagnosisSummary key={item.id} diagnosis={item} />
        ))}
      </section>
    </div>
  );
}
