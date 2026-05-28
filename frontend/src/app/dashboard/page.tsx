"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Bot, LogOut, ChevronLeft, ChevronRight, Search } from "lucide-react";

interface Application {
  id: number;
  job_description: string;
  resume: string;
  ai_score: number;
  created_at: string;
}

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();

  useEffect(() => {
    fetchApplications(page);
  }, [page]);

  const fetchApplications = async (pageNumber: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/applications/?page=${pageNumber}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch applications");
      }
      
      const data = await res.json();
      setApps(data.results);
      // DRF PageNumberPagination returns count
      setTotalPages(Math.ceil(data.count / 20)); 
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/");
  };

  const getScoreColor = (score: number) => {
    if (score < 5) return 'text-red-700 bg-red-100 border-red-200';
    if (score <= 7) return 'text-amber-700 bg-amber-100 border-amber-200';
    return 'text-green-700 bg-green-100 border-green-200';
  };

  const extractName = (resume: string) => {
    // A simple heuristic for the demo: assume first line might be a name
    const lines = resume.split('\n').filter(l => l.trim().length > 0);
    const potentialName = lines.length > 0 ? lines[0].substring(0, 30) : "Unknown Candidate";
    return potentialName.length === 30 ? potentialName + "..." : potentialName;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight">
          <Bot size={28} />
          ScreenIQ
        </div>
        <div className="flex items-center gap-4">
          <Link href="/screen" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            <Bot size={18} />
            New Screen
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 lg:p-10 max-w-6xl mx-auto w-full">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold mb-2">Past Screenings</h1>
            <p className="text-slate-500">Review and manage your AI-evaluated candidates.</p>
          </div>
          <Link 
            href="/screen"
            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors flex items-center gap-2"
          >
            <Bot size={18} /> Run New Screening
          </Link>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b text-slate-500 text-sm">
                  <th className="p-4 font-medium">Candidate Info</th>
                  <th className="p-4 font-medium">Job Context</th>
                  <th className="p-4 font-medium">Date Evaluated</th>
                  <th className="p-4 font-medium text-center">AI Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      <div className="flex justify-center mb-2"><Bot className="animate-bounce" /></div>
                      Loading applications...
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No screenings found. Start by running a new screening.
                    </td>
                  </tr>
                ) : (
                  apps.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900">{extractName(app.resume)}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs mt-1">
                          {app.resume.substring(0, 60)}...
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-700 truncate max-w-xs">
                          {app.job_description.substring(0, 60)}...
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-600">
                          {new Date(app.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(app.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full border font-bold ${getScoreColor(app.ai_score)}`}>
                          {app.ai_score}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{page}</span> of {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 bg-white border rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 bg-white border rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
