import type { TaskFamily } from "../contracts";

export const taskContextPolicyId = "local-arcade.task-context" as const;
export const taskContextPolicyVersion = 1 as const;

export type NoviceTaskScopeV1 =
  | {
    family: "coding";
    scope: "snippet" | "single-file" | "few-files" | "repository";
  }
  | {
    family: "writing";
    scope: "short-form" | "document" | "long-document";
  }
  | {
    family: "extraction";
    scope: "single-record" | "document" | "document-set";
  }
  | {
    family: "general";
    scope: "quick-question" | "conversation" | "reference-material";
  };

export type TaskContextPolicyInputV1 =
  | {
    policyVersion: 1;
    mode: "novice";
    task: NoviceTaskScopeV1;
  }
  | {
    policyVersion: 1;
    mode: "expert-override";
    task: {
      family: TaskFamily;
      scopeLabel: string;
    };
    contextTokens: number;
  };

export type TaskContextDecisionV1 = {
  policyId: typeof taskContextPolicyId;
  policyVersion: typeof taskContextPolicyVersion;
  source: "novice-derived" | "expert-override";
  task: {
    family: TaskFamily;
    scopeId: string | null;
    scopeLabel: string;
    derivedContextTokens: number;
  };
  explanation: string;
};

export type TaskContextPolicyResultV1 =
  | {
    status: "ok";
    data: TaskContextDecisionV1;
    warnings: string[];
  }
  | {
    status: "unavailable" | "blocked";
    reasonCode: string;
    message: string;
    recoverableActions: string[];
  };
