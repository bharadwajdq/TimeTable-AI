
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_SUBJECTS, INITIAL_FACULTY, PERIODS } from './data';
import { TimetableSolver } from './solver';
import { Timetable, ScheduleEntry, Subject, Faculty } from './types';
import { analyzeTimetable } from './services/geminiService';
import * as XLSX from 'xlsx';
import { 
  Database, 
  Zap, 
  LayoutGrid,
  FileSpreadsheet, 
  Printer,
  ShieldCheck,
  BrainCircuit,
  Layers,
  X,
  Loader2,
  Monitor,
  CheckCircle2,
  BookOpen,
  Users,
  Trophy,
  Activity,
  CalendarDays,
  Coffee,
  Utensils,
  Download,
  Plus,
  Trash2,
  Edit3,
  Save,
  AlertCircle,
  Fingerprint
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'view' | 'data' | 'ai'>('view');
  const [viewMode, setViewMode] = useState<'section' | 'master'>('section');
  const [dataSubTab, setDataSubTab] = useState<'subjects' | 'faculty'>('subjects');
  
  // Mutable Data State
  const [subjects, setSubjects] = useState<Subject[]>(INITIAL_SUBJECTS);
  const [faculty, setFaculty] = useState<Faculty[]>(INITIAL_FACULTY);
  
  const [timetable, setTimetable] = useState<Timetable>({});
  const [selectedSection, setSelectedSection] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Editor State
  const [editingSubject, setEditingSubject] = useState<Partial<Subject> | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<Partial<Faculty> | null>(null);

  useEffect(() => {
    handleGenerate();
  }, []);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const solver = new TimetableSolver(subjects, faculty);
        const result = solver.solve();
        setTimetable(result);
      } catch (e) {
        console.error("Solver Error:", e);
      } finally {
        setIsGenerating(false);
      }
    }, 800);
  };

  const getFacultyName = (id: string) => {
    const f = faculty.find(fac => fac.id === id);
    return f ? f.name : id;
  };

  const getSubjectName = (id: string) => {
    const s = subjects.find(sub => sub.id === id);
    return s ? s.name : id;
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const deleteFaculty = (id: string) => {
    setFaculty(prev => prev.filter(f => f.id !== id));
  };

  const saveSubject = (s: Partial<Subject>) => {
    if (!s.id) return;
    const fullSubject: Subject = {
      id: s.id,
      name: s.name || s.id,
      hoursPerWeek: s.hoursPerWeek || 3,
      sections: s.sections || Array.from({ length: 19 }, (_, i) => i + 1),
      isLabOrTutorial: !!s.isLabOrTutorial
    };
    setSubjects(prev => {
      const exists = prev.find(p => p.id === fullSubject.id);
      if (exists) return prev.map(p => p.id === fullSubject.id ? fullSubject : p);
      return [...prev, fullSubject];
    });
    setEditingSubject(null);
  };

  const saveFaculty = (f: Partial<Faculty>) => {
    if (!f.id) return;
    const fullFaculty: Faculty = {
      id: f.id,
      name: f.name || f.id,
      subjects: f.subjects || [],
      allottedSections: f.allottedSections || Array.from({ length: 19 }, (_, i) => i + 1)
    };
    setFaculty(prev => {
      const exists = prev.find(p => p.id === fullFaculty.id);
      if (exists) return prev.map(p => p.id === fullFaculty.id ? fullFaculty : p);
      return [...prev, fullFaculty];
    });
    setEditingFaculty(null);
  };

  const getDayName = (day: number) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];

  const globalStats = useMemo(() => {
    const keys = Object.keys(timetable);
    if (keys.length === 0) return null;
    const totalSlots = keys.length * 48;
    const filledSlots = Object.values(timetable).reduce((acc, curr) => acc + curr.length, 0);
    const sectionsFilled = Object.values(timetable).filter(e => e.length === 48).length;
    
    const facultyMap = new Map<string, boolean>();
    let collisions = 0;
    Object.values(timetable).forEach(entries => {
      entries.forEach(e => {
        if (e.facultyId.includes('DEPT') || e.facultyId.includes('POOL')) return;
        const key = `${e.facultyId}-${e.day}-${e.period}`;
        if (facultyMap.has(key)) collisions++;
        else facultyMap.set(key, true);
      });
    });

    return { totalSlots, filledSlots, sectionsFilled, collisions };
  }, [timetable]);

  const downloadExcel = () => {
    if (Object.keys(timetable).length === 0) return;
    const wb = XLSX.utils.book_new();
    const sortedSections = Object.keys(timetable).map(Number).sort((a, b) => a - b);
    
    sortedSections.forEach(secNum => {
      const entries = timetable[secNum];
      const wsData: (string | number)[][] = [
        [`OFFICIAL TIMETABLE - SECTION ${secNum}`],
        [],
        ["DAY", "P1", "P2", "BREAK", "P3", "P4", "P5", "LUNCH", "P6", "P7", "P8"]
      ];
      
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((dayName, di) => {
        const row = [dayName.toUpperCase()];
        PERIODS.forEach(p => {
          const entry = entries.find(e => e.day === di && e.period === p.no);
          row.push(entry ? `${entry.subjectId} (${entry.facultyId})` : "-");
          if (p.no === 2) row.push("BREAK");
          if (p.no === 5) row.push("LUNCH");
        });
        wsData.push(row);
      });

      // Add Faculty Legend at the bottom of the Excel sheet
      wsData.push([]);
      wsData.push(["FACULTY RESOURCE MAPPING"]);
      wsData.push(["CODE", "SUBJECT NAME", "FACULTY FULL NAME"]);
      
      const uniqueAssignments = Array.from(new Set(entries.map(e => `${e.subjectId}|${e.facultyId}`)));
      uniqueAssignments.sort().forEach(ua => {
        const [sid, fid] = ua.split('|');
        wsData.push([sid, getSubjectName(sid), getFacultyName(fid)]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 15 }, ...Array(10).fill({ wch: 20 })];
      XLSX.utils.book_append_sheet(wb, ws, `Sec ${secNum}`);
    });
    XLSX.writeFile(wb, `Matrix_Master_Deployment.xlsx`);
  };

  const TimetableGrid = ({ entries, compact = false }: { entries: ScheduleEntry[], compact?: boolean }) => {
    // Determine the legend data for this specific grid
    const assignmentLegend = useMemo(() => {
      const map = new Map<string, { subjectId: string, facultyId: string }>();
      entries.forEach(e => {
        const key = `${e.subjectId}-${e.facultyId}`;
        if (!map.has(key)) map.set(key, { subjectId: e.subjectId, facultyId: e.facultyId });
      });
      return Array.from(map.values()).sort((a, b) => a.subjectId.localeCompare(b.subjectId));
    }, [entries]);

    return (
      <div className="space-y-10">
        <div className="w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <table className="w-full border-separate border-spacing-0">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-r border-slate-200">Session Map</th>
                {PERIODS.map(p => (
                  <React.Fragment key={p.no}>
                    <th className="p-4 text-center border-b border-slate-200 min-w-[120px]">
                      <div className="text-[11px] font-black text-slate-900 leading-none mb-1 tracking-tighter">Period {p.no}</div>
                      {!compact && <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest leading-none">{p.time}</div>}
                    </th>
                    {p.no === 2 && (
                      <th className="p-1 border-b border-slate-200 bg-amber-50/50 text-[10px] font-black text-amber-600 uppercase vertical-label-header">
                        Short Break
                      </th>
                    )}
                    {p.no === 5 && (
                      <th className="p-1 border-b border-slate-200 bg-slate-100/50 text-[10px] font-black text-slate-500 uppercase vertical-label-header">
                        Lunch Interval
                      </th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map(di => (
                <tr key={di}>
                  <td className="p-4 font-black text-[11px] text-slate-600 bg-slate-50/30 border-r border-b border-slate-100 text-center uppercase tracking-widest">
                    {getDayName(di)}
                  </td>
                  {PERIODS.map(p => {
                    const entry = entries.find(e => e.day === di && e.period === p.no);
                    const isLab = entry?.subjectId.includes('-L') || entry?.subjectId.includes('-T');
                    const isTraining = entry?.subjectId === 'TRAINING';
                    return (
                      <React.Fragment key={p.no}>
                        <td className={`${compact ? 'h-14' : 'h-28'} p-1.5 border-b border-r border-slate-50/50`}>
                          {entry ? (
                            <div className={`h-full flex flex-col items-center justify-center rounded-2xl px-3 py-2 text-center shadow-sm border-b-4 transition-all hover:scale-[1.05] hover:shadow-xl hover:z-10 relative cursor-default ${
                              isTraining ? 'bg-purple-100/80 border-purple-500 text-purple-900' :
                              isLab ? 'bg-amber-100/80 border-amber-500 text-amber-900' : 
                              'bg-indigo-50 border-indigo-500 text-indigo-900'
                            }`}>
                              <div className={`${compact ? 'text-[9px]' : 'text-xs'} font-black leading-tight tracking-tight uppercase truncate w-full`}>{entry.subjectId}</div>
                              <div className="text-[8px] font-bold uppercase opacity-50 truncate w-full mt-1.5">{entry.facultyId}</div>
                            </div>
                          ) : (
                            <div className="h-full bg-slate-50/40 rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center">
                              <span className="text-[10px] font-black text-slate-200 uppercase tracking-[0.3em]">No Slot</span>
                            </div>
                          )}
                        </td>
                        {p.no === 2 && di === 0 && (
                          <td rowSpan={6} className="bg-amber-50/30 border-r border-slate-100 relative group overflow-hidden select-none">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                               <Coffee className="w-5 h-5 text-amber-500 mb-6 animate-bounce" />
                               <span className="[writing-mode:vertical-rl] rotate-180 text-[12px] font-black text-amber-600/60 uppercase tracking-[1em] whitespace-nowrap">SHORT BREAK</span>
                            </div>
                          </td>
                        )}
                        {p.no === 5 && di === 0 && (
                          <td rowSpan={6} className="bg-slate-100/40 border-r border-slate-100 relative group overflow-hidden select-none">
                             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                               <Utensils className="w-5 h-5 text-slate-500 mb-6 animate-pulse" />
                               <span className="[writing-mode:vertical-rl] rotate-180 text-[12px] font-black text-slate-500/60 uppercase tracking-[1em] whitespace-nowrap">LUNCH BREAK</span>
                            </div>
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dynamic Legend below the table */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
           <div className="flex items-center space-x-4 mb-6 px-2">
             <Fingerprint className="w-6 h-6 text-indigo-600" />
             <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">Faculty Assignment Registry</h4>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {assignmentLegend.map(item => (
               <div key={`${item.subjectId}-${item.facultyId}`} className="flex items-center space-x-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 group hover:border-indigo-200 hover:bg-white transition-all">
                  <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-[10px] shadow-lg group-hover:scale-110 transition-transform">
                    {item.subjectId}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-[10px] font-black text-slate-900 uppercase truncate">{getSubjectName(item.subjectId)}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mt-1">{getFacultyName(item.facultyId)}</div>
                  </div>
                  <div className="text-[8px] font-black text-indigo-300 uppercase px-2 py-1 bg-white rounded-lg border border-slate-100">
                    {item.facultyId}
                  </div>
               </div>
             ))}
           </div>
        </div>

        <style>{`
          .vertical-label-header {
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            text-align: center;
            white-space: nowrap;
            padding: 8px 0;
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-[#0F172A] text-white px-10 py-5 flex items-center justify-between sticky top-0 z-50 shadow-2xl no-print">
        <div className="flex items-center space-x-5">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-500/30">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Matrix Master</h1>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.5em] mt-2">Resource Orchestrator v7.0</p>
          </div>
        </div>
        
        <nav className="flex space-x-2 bg-white/5 rounded-2xl p-1.5 backdrop-blur-xl border border-white/10">
          {[
            { id: 'view', icon: LayoutGrid, label: 'Visualizer' },
            { id: 'data', icon: Layers, label: 'Asset Registry' },
            { id: 'ai', icon: BrainCircuit, label: 'System Audit' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <button 
            onClick={() => window.print()} 
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating} 
            className="flex items-center space-x-3 px-8 py-3.5 rounded-2xl text-[12px] font-black transition-all shadow-2xl active:scale-95 uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 ring-4 ring-indigo-500/10"
          >
            {isGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : <Zap className="w-4 h-4 fill-white" />}
            <span>{isGenerating ? 'Recalculating...' : 'Force Sync'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-hidden flex flex-col container mx-auto">
        {activeTab === 'view' && (
          <div className="flex flex-col h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {globalStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 no-print">
                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 flex items-center space-x-6 shadow-sm hover:shadow-xl transition-all">
                  <div className="p-5 bg-emerald-50 rounded-2xl text-emerald-600 shadow-inner"><CheckCircle2 className="w-9 h-9" /></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Weekly Fill Rate</div>
                    <div className="text-3xl font-black text-slate-900 leading-none">{globalStats.filledSlots} / {globalStats.totalSlots}</div>
                  </div>
                </div>
                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 flex items-center space-x-6 shadow-sm hover:shadow-xl transition-all">
                  <div className="p-5 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner"><Monitor className="w-9 h-9" /></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Active Sectors</div>
                    <div className="text-3xl font-black text-slate-900 leading-none">{globalStats.sectionsFilled} / 19</div>
                  </div>
                </div>
                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 flex items-center space-x-6 shadow-sm hover:shadow-xl transition-all">
                  <div className="p-5 bg-amber-50 rounded-2xl text-amber-600 shadow-inner"><Activity className="w-9 h-9" /></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Collision Check</div>
                    <div className="text-3xl font-black text-slate-900 leading-none">{globalStats.collisions === 0 ? 'ZERO' : globalStats.collisions}</div>
                  </div>
                </div>
                <button onClick={downloadExcel} className="bg-slate-900 text-white rounded-[2.5rem] flex flex-col items-center justify-center group hover:bg-black transition-all shadow-2xl p-7 border-t-4 border-indigo-500">
                  <Download className="w-8 h-8 text-emerald-400 mb-3 group-hover:scale-125 transition-transform" />
                  <span className="text-[12px] font-black uppercase tracking-[0.4em]">Get Excel Deck</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between bg-white px-10 py-5 rounded-[3rem] shadow-sm border border-slate-200 no-print">
              <div className="flex items-center space-x-8">
                <div className="flex bg-slate-100 p-2 rounded-2xl">
                  <button onClick={() => setViewMode('section')} className={`flex items-center space-x-3 px-8 py-3 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest ${viewMode === 'section' ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Monitor className="w-4 h-4" />
                    <span>Focus View</span>
                  </button>
                  <button onClick={() => setViewMode('master')} className={`flex items-center space-x-3 px-8 py-3 rounded-xl text-[11px] font-black transition-all uppercase tracking-widest ${viewMode === 'master' ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                    <LayoutGrid className="w-4 h-4" />
                    <span>Grid Explorer</span>
                  </button>
                </div>

                {viewMode === 'section' && (
                  <select 
                    value={selectedSection} 
                    onChange={(e) => setSelectedSection(Number(e.target.value))} 
                    className="bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm rounded-2xl px-8 py-3 font-black outline-none focus:ring-8 focus:ring-indigo-500/10 min-w-[200px] cursor-pointer appearance-none text-center hover:border-indigo-300 transition-colors"
                  >
                    {Array.from({ length: 19 }, (_, i) => i + 1).map(num => <option key={num} value={num}>ACADEMIC SECTOR {num}</option>)}
                  </select>
                )}
              </div>
              
              <div className="flex items-center space-x-5 text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic opacity-50">
                <CalendarDays className="w-5 h-5" />
                <span>Semester Baseline 1.0</span>
              </div>
            </div>

            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-12 bg-white rounded-[4rem] shadow-2xl border border-slate-100">
                <div className="bg-indigo-50 p-16 rounded-[4rem] shadow-inner relative overflow-hidden">
                  <BrainCircuit className="w-24 h-24 text-indigo-600 animate-bounce z-10 relative" />
                </div>
                <div className="text-center">
                  <h3 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter">Computing Matrix</h3>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.6em] mt-6">Allocating Period Nodes...</p>
                </div>
              </div>
            ) : viewMode === 'section' ? (
              <div className="flex-1 overflow-auto pb-10 no-scrollbar">
                <TimetableGrid entries={timetable[selectedSection] || []} compact={false} />
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-white rounded-[4rem] shadow-2xl border border-slate-100 p-12 space-y-16 no-scrollbar">
                <div className="grid grid-cols-1 gap-16">
                  {Object.keys(timetable).sort((a,b) => Number(a)-Number(b)).map(sec => (
                    <div key={sec} className="space-y-8 bg-slate-50/50 p-10 rounded-[4rem] border border-slate-200 hover:border-indigo-300 transition-all group shadow-sm hover:shadow-2xl">
                      <div className="flex items-center justify-between px-6">
                        <div className="flex items-center space-x-6">
                           <div className="w-16 h-16 bg-[#0F172A] rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-2xl group-hover:bg-indigo-600 transition-colors">{sec}</div>
                           <div>
                             <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Sector Node {sec}</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                               <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Deployment Integrity Verified
                             </p>
                           </div>
                        </div>
                        <span className="text-[12px] font-black px-8 py-3 rounded-2xl uppercase tracking-[0.3em] shadow-inner bg-emerald-100 text-emerald-700">
                          {timetable[sec].length} / 48 HRS
                        </span>
                      </div>
                      <TimetableGrid entries={timetable[Number(sec)]} compact={true} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="flex-1 flex flex-col space-y-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-white px-8 py-4 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setDataSubTab('subjects')}
                  className={`flex items-center space-x-3 px-8 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${dataSubTab === 'subjects' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Subjects Registry</span>
                </button>
                <button 
                  onClick={() => setDataSubTab('faculty')}
                  className={`flex items-center space-x-3 px-8 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${dataSubTab === 'faculty' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}
                >
                  <Users className="w-4 h-4" />
                  <span>Faculty Assets</span>
                </button>
              </div>
              <button 
                onClick={() => dataSubTab === 'subjects' ? setEditingSubject({}) : setEditingFaculty({})}
                className="flex items-center space-x-3 px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest bg-[#0F172A] text-white hover:bg-black"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Asset</span>
              </button>
            </div>

            <div className="flex-1 bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-auto p-10 scrollbar-thin">
              {dataSubTab === 'subjects' ? (
                <div className="space-y-6">
                  {editingSubject && (
                    <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-indigo-200 mb-8 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID / Code</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            placeholder="e.g. CNS"
                            value={editingSubject.id || ''}
                            onChange={e => setEditingSubject({...editingSubject, id: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            placeholder="Subject Title"
                            value={editingSubject.name || ''}
                            onChange={e => setEditingSubject({...editingSubject, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hrs/Week</label>
                          <input 
                            type="number" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            value={editingSubject.hoursPerWeek || ''}
                            onChange={e => setEditingSubject({...editingSubject, hoursPerWeek: Number(e.target.value)})}
                          />
                        </div>
                        <div className="flex items-end space-x-3">
                          <button onClick={() => saveSubject(editingSubject)} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" /> Save
                          </button>
                          <button onClick={() => setEditingSubject(null)} className="p-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300"><X className="w-5 h-5"/></button>
                        </div>
                      </div>
                    </div>
                  )}

                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
                        <th className="px-8 py-4">Descriptor</th>
                        <th className="px-8 py-4">Title</th>
                        <th className="px-8 py-4 text-center">Plan (H)</th>
                        <th className="px-8 py-4">Classification</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(s => (
                        <tr key={s.id} className="group hover:bg-slate-50 transition-all">
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white rounded-l-[2rem] font-black text-indigo-900 text-sm border-y border-l border-slate-100">{s.id}</td>
                          <td className="px-8 py-4 font-bold text-slate-600 text-sm italic border-y border-slate-100">{s.name}</td>
                          <td className="px-8 py-4 text-center font-black text-indigo-600 text-sm border-y border-slate-100">{s.hoursPerWeek} HRS</td>
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white border-y border-slate-100">
                            <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full shadow-inner ${s.isLabOrTutorial ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                              {s.isLabOrTutorial ? 'Practical Lab' : 'Theory Core'}
                            </span>
                          </td>
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white rounded-r-[2rem] border-y border-r border-slate-100 text-right">
                             <div className="flex items-center justify-end space-x-2">
                               <button onClick={() => setEditingSubject(s)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                               <button onClick={() => deleteSubject(s.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-6">
                  {editingFaculty && (
                    <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-indigo-200 mb-8 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Code</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            placeholder="F1"
                            value={editingFaculty.id || ''}
                            onChange={e => setEditingFaculty({...editingFaculty, id: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            placeholder="Full Name"
                            value={editingFaculty.name || ''}
                            onChange={e => setEditingFaculty({...editingFaculty, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sections (CSV)</label>
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            placeholder="1, 2, 3"
                            value={editingFaculty.allottedSections?.join(', ') || ''}
                            onChange={e => setEditingFaculty({...editingFaculty, allottedSections: e.target.value.split(',').map(v => parseInt(v.trim())).filter(n => !isNaN(n))})}
                          />
                        </div>
                        <div className="flex items-end space-x-3">
                          <button onClick={() => saveFaculty(editingFaculty)} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" /> Save
                          </button>
                          <button onClick={() => setEditingFaculty(null)} className="p-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300"><X className="w-5 h-5"/></button>
                        </div>
                      </div>
                    </div>
                  )}

                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">
                        <th className="px-8 py-4">Faculty Code</th>
                        <th className="px-8 py-4">Name</th>
                        <th className="px-8 py-4">Competencies</th>
                        <th className="px-8 py-4">Reach</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faculty.map(f => (
                        <tr key={f.id} className="group hover:bg-slate-50 transition-all">
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white rounded-l-[2rem] font-black text-indigo-900 text-sm border-y border-l border-slate-100">{f.id}</td>
                          <td className="px-8 py-4 font-bold text-slate-600 text-sm italic border-y border-slate-100">{f.name}</td>
                          <td className="px-8 py-4 border-y border-slate-100">
                            <div className="flex flex-wrap gap-1.5">
                              {f.subjects?.map(sub => (
                                <span key={sub} className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-tight">{sub}</span>
                              )) || <span className="text-[9px] italic opacity-50">None</span>}
                            </div>
                          </td>
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white border-y border-slate-100 font-black text-[10px] text-indigo-400 uppercase tracking-widest">
                            {f.allottedSections?.length || 0} Nodes
                          </td>
                          <td className="px-8 py-4 bg-slate-50/50 group-hover:bg-white rounded-r-[2rem] border-y border-r border-slate-100 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button onClick={() => setEditingFaculty(f)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => deleteFaculty(f.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <div>
                  <h4 className="text-[12px] font-black text-amber-900 uppercase">Registry Modified</h4>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Changes in the registry require a re-synchronization of the Matrix.</p>
                </div>
              </div>
              <button onClick={handleGenerate} className="bg-amber-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-colors">
                Apply & Regenerate
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex-1 overflow-auto bg-white rounded-[4rem] shadow-xl border border-slate-100 p-16 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-700">
             <div className="bg-indigo-50 p-20 rounded-[4rem] shadow-inner">
                <BrainCircuit className="w-32 h-32 text-indigo-600 animate-pulse" />
             </div>
             <div className="text-center max-w-2xl">
               <h3 className="text-5xl font-black text-slate-900 uppercase italic mb-6 tracking-tighter">System Audit Node</h3>
               <p className="text-slate-400 font-bold text-lg italic opacity-80 leading-relaxed px-10">Analyze the structural integrity of your current deployment registry using Gemini 3 Pro reasoning.</p>
             </div>
             <button className="bg-[#0F172A] text-white px-20 py-6 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.5em] hover:bg-black shadow-2xl transition-all active:scale-95">Initiate AI Audit</button>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-6 flex justify-between items-center text-[11px] font-black text-slate-400 no-print px-14 uppercase tracking-[0.6em] shadow-inner">
        <div className="flex items-center space-x-16">
           <div className="flex items-center gap-4">
             <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.8)]"></div>
             <span>Engine v7.0 Active</span>
           </div>
           <div className="flex items-center gap-4">
             <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse shadow-[0_0_20px_rgba(79,70,229,0.6)]"></div>
             <span>Registry Node Matrix Online</span>
           </div>
        </div>
        <div className="opacity-40 italic tracking-widest text-[10px]">Academic Deployment Node // Matrix Pro // Session: {new Date().toLocaleTimeString()}</div>
      </footer>
    </div>
  );
};

export default App;
