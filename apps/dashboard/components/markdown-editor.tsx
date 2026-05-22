"use client";

import ReactMarkdown from "react-markdown";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  mode: "edit" | "preview" | "split";
};

export function MarkdownEditor({ value, onChange, mode }: MarkdownEditorProps) {
  if (mode === "preview") {
    return (
      <div className="min-h-[240px] rounded-md border border-gray-300 bg-white p-3 text-sm">
        <ReactMarkdown>{value || "(No content)"}</ReactMarkdown>
      </div>
    );
  }

  if (mode === "split") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          className="min-h-[240px] w-full rounded-md border border-gray-300 px-3 py-2"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="min-h-[240px] rounded-md border border-gray-300 bg-white p-3 text-sm">
          <ReactMarkdown>{value || "(No content)"}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <textarea
      className="min-h-[240px] w-full rounded-md border border-gray-300 px-3 py-2"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
