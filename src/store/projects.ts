import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProjectFile = {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  modified?: boolean;
};

export type ProjectType = "react" | "html" | "blank";

export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive";
  files: ProjectFile[];
  publishedToGithub?: boolean;
  githubRepoUrl?: string;
};

type EditorState = {
  openFileIds: string[];
  activeFileId: string | null;
  activePanel: "explorer" | "search" | "scm" | "extensions" | "copilot" | "settings";
  showPreview: boolean;
};

type Store = {
  projects: Project[];
  editors: Record<string, EditorState>;
  createProject: (name: string, type: ProjectType) => Project;
  deleteProject: (id: string) => void;
  importFiles: (name: string, files: { name: string; path: string; content: string }[]) => Project;
  updateFile: (projectId: string, fileId: string, content: string) => void;
  addFile: (projectId: string, name: string) => void;
  deleteFile: (projectId: string, fileId: string) => void;
  renameFile: (projectId: string, fileId: string, name: string) => void;
  openFile: (projectId: string, fileId: string) => void;
  closeFile: (projectId: string, fileId: string) => void;
  setActivePanel: (projectId: string, panel: EditorState["activePanel"]) => void;
  setShowPreview: (projectId: string, show: boolean) => void;
  publishToGithub: (projectId: string, url: string) => void;
};

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

function langFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "css":
      return "css";
    case "html":
      return "html";
    case "json":
      return "json";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

function reactTemplate(): ProjectFile[] {
  return [
    {
      id: uid(),
      name: "index.html",
      path: "index.html",
      language: "html",
      content: `<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>App</title><link rel="stylesheet" href="./App.css"/></head>
  <body><div id="root"></div><script type="module" src="./index.jsx"></script></body>
</html>`,
    },
    {
      id: uid(),
      name: "index.jsx",
      path: "index.jsx",
      language: "javascript",
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`,
    },
    {
      id: uid(),
      name: "App.jsx",
      path: "App.jsx",
      language: "javascript",
      content: `import React, { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <h1>⚛️ React App</h1>
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
        <p>Edit <code>App.jsx</code> and save.</p>
      </div>
    </div>
  );
}
`,
    },
    {
      id: uid(),
      name: "App.css",
      path: "App.css",
      language: "css",
      content: `body{margin:0;font-family:system-ui;background:#0b1220;color:#fff}
.app{min-height:100vh;display:grid;place-items:center;text-align:center}
.card{padding:24px;border:1px solid #1e293b;border-radius:12px}
button{background:#3b82f6;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer}
`,
    },
  ];
}

function htmlTemplate(): ProjectFile[] {
  return [
    {
      id: uid(),
      name: "index.html",
      path: "index.html",
      language: "html",
      content: `<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>App</title><link rel="stylesheet" href="./style.css"/></head>
  <body>
    <h1>Hello Trx</h1>
    <button id="b">Click</button>
    <script src="./script.js"></script>
  </body>
</html>`,
    },
    {
      id: uid(),
      name: "style.css",
      path: "style.css",
      language: "css",
      content: `body{font-family:system-ui;background:#0b1220;color:#fff;display:grid;place-items:center;min-height:100vh}`,
    },
    {
      id: uid(),
      name: "script.js",
      path: "script.js",
      language: "javascript",
      content: `document.getElementById('b').onclick=()=>alert('Hi from Trx');`,
    },
  ];
}

function blankTemplate(): ProjectFile[] {
  return [
    {
      id: uid(),
      name: "README.md",
      path: "README.md",
      language: "markdown",
      content: "# New Project\n\nStart coding.",
    },
  ];
}

function templateFor(type: ProjectType) {
  if (type === "react") return reactTemplate();
  if (type === "html") return htmlTemplate();
  return blankTemplate();
}

const now = () => new Date().toISOString();

export const useProjectStore = create<Store>()(
  persist(
    (set, get) => ({
      projects: [],
      editors: {},
      createProject: (name, type) => {
        const files = templateFor(type);
        const project: Project = {
          id: uid(),
          name,
          type,
          createdAt: now(),
          updatedAt: now(),
          status: "active",
          files,
        };
        set((s) => ({
          projects: [project, ...s.projects],
          editors: {
            ...s.editors,
            [project.id]: {
              openFileIds: files[0] ? [files[0].id] : [],
              activeFileId: files[0]?.id ?? null,
              activePanel: "explorer",
              showPreview: false,
            },
          },
        }));
        return project;
      },
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      importFiles: (name, files) => {
        const pf: ProjectFile[] = files.map((f) => ({
          id: uid(),
          name: f.name,
          path: f.path,
          content: f.content,
          language: langFor(f.name),
        }));
        const project: Project = {
          id: uid(),
          name,
          type: "blank",
          createdAt: now(),
          updatedAt: now(),
          status: "active",
          files: pf,
        };
        set((s) => ({
          projects: [project, ...s.projects],
          editors: {
            ...s.editors,
            [project.id]: {
              openFileIds: pf[0] ? [pf[0].id] : [],
              activeFileId: pf[0]?.id ?? null,
              activePanel: "explorer",
              showPreview: false,
            },
          },
        }));
        return project;
      },
      updateFile: (projectId, fileId, content) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now(),
                  files: p.files.map((f) =>
                    f.id === fileId ? { ...f, content, modified: true } : f,
                  ),
                }
              : p,
          ),
        })),
      addFile: (projectId, name) =>
        set((s) => {
          const file: ProjectFile = {
            id: uid(),
            name,
            path: name,
            content: "",
            language: langFor(name),
          };
          return {
            projects: s.projects.map((p) =>
              p.id === projectId ? { ...p, files: [...p.files, file] } : p,
            ),
            editors: {
              ...s.editors,
              [projectId]: {
                ...(s.editors[projectId] ?? {
                  openFileIds: [],
                  activeFileId: null,
                  activePanel: "explorer",
                  showPreview: false,
                }),
                openFileIds: [
                  ...(s.editors[projectId]?.openFileIds ?? []),
                  file.id,
                ],
                activeFileId: file.id,
              },
            },
          };
        }),
      deleteFile: (projectId, fileId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
              : p,
          ),
          editors: {
            ...s.editors,
            [projectId]: {
              ...(s.editors[projectId] ?? {
                openFileIds: [],
                activeFileId: null,
                activePanel: "explorer",
                showPreview: false,
              }),
              openFileIds: (s.editors[projectId]?.openFileIds ?? []).filter(
                (id) => id !== fileId,
              ),
              activeFileId:
                s.editors[projectId]?.activeFileId === fileId
                  ? null
                  : s.editors[projectId]?.activeFileId ?? null,
            },
          },
        })),
      renameFile: (projectId, fileId, name) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  files: p.files.map((f) =>
                    f.id === fileId
                      ? { ...f, name, path: name, language: langFor(name) }
                      : f,
                  ),
                }
              : p,
          ),
        })),
      openFile: (projectId, fileId) =>
        set((s) => {
          const ed = s.editors[projectId] ?? {
            openFileIds: [],
            activeFileId: null,
            activePanel: "explorer" as const,
            showPreview: false,
          };
          return {
            editors: {
              ...s.editors,
              [projectId]: {
                ...ed,
                openFileIds: ed.openFileIds.includes(fileId)
                  ? ed.openFileIds
                  : [...ed.openFileIds, fileId],
                activeFileId: fileId,
              },
            },
          };
        }),
      closeFile: (projectId, fileId) =>
        set((s) => {
          const ed = s.editors[projectId];
          if (!ed) return {};
          const openFileIds = ed.openFileIds.filter((id) => id !== fileId);
          return {
            editors: {
              ...s.editors,
              [projectId]: {
                ...ed,
                openFileIds,
                activeFileId:
                  ed.activeFileId === fileId
                    ? openFileIds[openFileIds.length - 1] ?? null
                    : ed.activeFileId,
              },
            },
          };
        }),
      setActivePanel: (projectId, panel) =>
        set((s) => ({
          editors: {
            ...s.editors,
            [projectId]: {
              ...(s.editors[projectId] ?? {
                openFileIds: [],
                activeFileId: null,
                activePanel: "explorer",
                showPreview: false,
              }),
              activePanel: panel,
            },
          },
        })),
      setShowPreview: (projectId, show) =>
        set((s) => ({
          editors: {
            ...s.editors,
            [projectId]: {
              ...(s.editors[projectId] ?? {
                openFileIds: [],
                activeFileId: null,
                activePanel: "explorer",
                showPreview: false,
              }),
              showPreview: show,
            },
          },
        })),
      publishToGithub: (projectId, url) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? { ...p, publishedToGithub: true, githubRepoUrl: url }
              : p,
          ),
        })),
    }),
    { name: "trx-ide-store" },
  ),
);

export { langFor };