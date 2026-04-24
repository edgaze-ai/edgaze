import type { WorkflowInput } from "./run-types";

export const YOUTUBE_TRANSCRIPT_SPEC_ID = "youtube-transcript" as const;
export const YOUTUBE_TRANSCRIPT_MANUAL_SUFFIX = "__manualTranscript" as const;

export type YoutubeTranscriptRecoveryRequest = {
  kind: "youtube_transcript_manual_fallback";
  nodeId: string;
  inputKey: string;
  title: string;
  message: string;
  inputName: string;
  inputDescription: string;
  placeholder?: string;
};

export function getYoutubeTranscriptManualInputKey(nodeId: string): string {
  return `${nodeId}${YOUTUBE_TRANSCRIPT_MANUAL_SUFFIX}`;
}

export function buildYoutubeTranscriptRecoveryRequest(params: {
  nodeId: string;
  nodeTitle?: string | null;
}): YoutubeTranscriptRecoveryRequest {
  const title = params.nodeTitle?.trim() || "YouTube Transcript";
  return {
    kind: "youtube_transcript_manual_fallback",
    nodeId: params.nodeId,
    inputKey: getYoutubeTranscriptManualInputKey(params.nodeId),
    title: "Couldn't fetch transcript automatically",
    message:
      "Captions were unavailable for this video. Paste the transcript below and we'll continue the run instead of failing it.",
    inputName: `${title} transcript`,
    inputDescription:
      "Paste the transcript exactly as you want downstream nodes to receive it. You can keep the YouTube URL above and rerun immediately.",
    placeholder: "Paste the YouTube transcript here...",
  };
}

export function appendYoutubeTranscriptRecoveryInput(
  inputs: WorkflowInput[],
  request: YoutubeTranscriptRecoveryRequest,
): WorkflowInput[] {
  const existing = inputs.find((input) => input.nodeId === request.inputKey);
  const recoveryInput: WorkflowInput = {
    nodeId: request.inputKey,
    specId: YOUTUBE_TRANSCRIPT_SPEC_ID,
    name: request.inputName,
    description: request.inputDescription,
    type: "textarea",
    required: true,
    placeholder: request.placeholder,
  };

  if (existing) {
    return inputs.map((input) => (input.nodeId === request.inputKey ? recoveryInput : input));
  }

  return [...inputs, recoveryInput];
}

export class YoutubeTranscriptFallbackRequiredError extends Error {
  readonly recovery: YoutubeTranscriptRecoveryRequest;

  constructor(recovery: YoutubeTranscriptRecoveryRequest, causeMessage?: string) {
    super(causeMessage || recovery.message);
    this.name = "YoutubeTranscriptFallbackRequiredError";
    this.recovery = recovery;
  }
}

export function isYoutubeTranscriptFallbackRequiredError(
  value: unknown,
): value is YoutubeTranscriptFallbackRequiredError {
  return value instanceof YoutubeTranscriptFallbackRequiredError;
}
