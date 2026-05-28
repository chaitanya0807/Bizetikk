"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Briefcase, Bot, LayoutDashboard, LogOut } from "lucide-react";

// Local state reducer for the form
type State = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'streaming'; partial: string }
  | { status: 'done'; score: number; reasons: string[] }
  | { status: 'error'; message: string };

type Action = 
  | { type: 'START' }
  | { type: 'STREAM'; partial: string }
  | { type: 'DONE'; score: number; reasons: string[] }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

function screenReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START': return { status: 'loading' };
    case 'STREAM': return { status: 'streaming', partial: action.partial };
    case 'DONE': return { status: 'done', score: action.score, reasons: action.reasons };
    case 'ERROR': return { status: 'error', message: action.message };
    case 'RESET': return { status: 'idle' };
    default: return state;
  }
}

export default function ScreenPage() {
  const [jobDesc, setJobDesc] = useState("");
  const [resume, setResume] = useState("");
  const [state, dispatch] = useReducer(screenReducer, { status: 'idle' });
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDesc || !resume) {
      dispatch({ type: 'ERROR', message: "Both fields are required." });
      return;
    }

    dispatch({ type: 'START' });
    const token = localStorage.getItem("access_token");

    try {
      // Use SSE streaming
      const url = `http://localhost:8000/api/screen/?stream=true`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ job_description: jobDesc, resume })
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/");
          return;
        }
        throw new Error("API Request failed");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // The server sends events separated by \n\n
        const events = chunk.split('\n\n');
        
        for (const event of events) {
          if (event.startsWith('data: ')) {
            const dataStr = event.substring(6);
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                dispatch({ type: 'ERROR', message: data.error });
                return;
              }
              if (data.done) {
                // Done event gives us the saved ID, but the text is already full
                // Parse the full text here to extract final score and reasons
                let cleaned = fullText.trim();
                if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
                if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);
                
                try {
                  const finalJson = JSON.parse(cleaned);
                  dispatch({ 
                    type: 'DONE', 
                    score: parseInt(finalJson.score) || 0, 
                    reasons: finalJson.reasons || [] 
                  });
                } catch(e) {
                  dispatch({ type: 'ERROR', message: "Failed to parse final AI output." });
                }
                return;
              }
              if (data.chunk) {
                fullText += data.chunk;
                dispatch({ type: 'STREAM', partial: fullText });
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk", dataStr);
            }
          }
        }
      }
    } catch (err: any) {
      dispatch({ type: 'ERROR', message: err.message });
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 5) return 'text-red-600 bg-red-100 border-red-200';
    if (score <= 7) return 'text-amber-600 bg-amber-100 border-amber-200';
    return 'text-green-600 bg-green-100 border-green-200';
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight">
          <Bot size={28} />
          ScreenIQ
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FileText className="text-blue-500" />
            New Screening
          </h2>
          
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 space-y-6">
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Briefcase size={16} /> Job Description
              </label>
              <textarea 
                className="w-full flex-1 min-h-[200px] p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400"
                placeholder="Paste the job description here..."
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
              />
            </div>
            
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <FileText size={16} /> Candidate Resume
              </label>
              <textarea 
                className="w-full flex-1 min-h-[200px] p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm bg-slate-50 text-slate-900 placeholder:text-slate-400"
                placeholder="Paste the candidate's resume here..."
                value={resume}
                onChange={e => setResume(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={state.status === 'loading' || state.status === 'streaming'}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {state.status === 'loading' || state.status === 'streaming' ? (
                <><Bot className="animate-pulse" /> Evaluating Candidate...</>
              ) : (
                <><Bot /> Generate AI Score</>
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 flex flex-col text-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          <h2 className="text-xl font-bold mb-6 text-blue-400 flex items-center gap-2">
            AI Analysis Result
          </h2>
          
          {state.status === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
              <Bot size={48} className="mb-4 opacity-50" />
              <p>Submit a job description and resume to see the AI evaluation.</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="p-4 bg-red-900/50 border border-red-800 text-red-200 rounded-xl">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{state.message}</p>
            </div>
          )}

          {state.status === 'streaming' && (
            <div className="flex-1 flex flex-col">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 animate-pulse border border-slate-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-500">?</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-slate-300">Generating Score...</h3>
                  <p className="text-sm text-slate-500">Streaming response from Gemini</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-sm text-slate-400 whitespace-pre-wrap border border-slate-800 flex-1 overflow-auto">
                {state.partial}
                <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
              </div>
            </div>
          )}

          {state.status === 'done' && (
            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 flex items-center gap-4">
                <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center shadow-lg ${getScoreColor(state.score)}`}>
                  <span className="text-3xl font-black">{state.score}</span>
                  <span className="text-[10px] uppercase font-bold opacity-80">/ 10</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Candidate Score</h3>
                  <p className="text-slate-400">AI-generated compatibility rating</p>
                </div>
              </div>
              
              <h4 className="font-semibold text-blue-400 mb-4 uppercase tracking-wider text-sm">Key Reasons</h4>
              <ul className="space-y-3">
                {state.reasons.map((reason, i) => (
                  <li key={i} className="flex gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <span className="text-blue-400 font-bold shrink-0 mt-0.5">•</span>
                    <span className="text-slate-200 leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
