
import { Subject, Faculty, ScheduleEntry, Timetable } from './types';

export class TimetableSolver {
  private subjects: Subject[];
  private faculty: Faculty[];
  private sections: number[];
  
  private globalFacultyBusy: Map<string, boolean[][]> = new Map();
  private sectionBusy: Map<number, boolean[][]> = new Map();
  private subjectDayTracker: Map<string, number> = new Map();

  constructor(subjects: Subject[], faculty: Faculty[], sectionCount: number = 19) {
    this.subjects = subjects;
    this.faculty = faculty;
    this.sections = Array.from({ length: sectionCount }, (_, i) => i + 1);
  }

  private initMatrices() {
    this.globalFacultyBusy.clear();
    this.sectionBusy.clear();
    this.subjectDayTracker.clear();

    this.faculty.forEach(f => {
      if (f.id) {
        this.globalFacultyBusy.set(f.id, Array.from({ length: 6 }, () => Array(9).fill(false)));
      }
    });

    this.sections.forEach(s => {
      this.sectionBusy.set(s, Array.from({ length: 6 }, () => Array(9).fill(false)));
    });
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private getUniqueFacultyId(rawId: string, section: number): string {
    if (!rawId) return `UNASSIGNED_S${section}`;
    if (rawId.includes('DEPT') || rawId.includes('POOL') || rawId.includes('TRAINING') || rawId.includes('QLR')) {
      return `${rawId}_S${section}`;
    }
    return rawId;
  }

  private canPlace(facultyId: string, section: number, day: number, period: number, subjectId: string): boolean {
    if (period < 1 || period > 8 || day < 0 || day > 5) return false;
    
    // Check if section is already busy at this time
    const sMatrix = this.sectionBusy.get(section);
    if (!sMatrix || sMatrix[day][period]) return false;

    // Check global faculty exclusivity
    const fMatrix = this.globalFacultyBusy.get(facultyId);
    if (fMatrix && fMatrix[day][period]) return false;

    // Daily Load Balancing (Soft constraint: Max 2 of same subject per day)
    // Training is an exception: it happens all in one day (6 hours)
    if (subjectId !== 'TRAINING') {
        const trackerKey = `${section}-${subjectId}-${day}`;
        if ((this.subjectDayTracker.get(trackerKey) || 0) >= 2) return false;
    }

    return true;
  }

  private markBusy(facultyId: string, section: number, day: number, period: number, subjectId: string) {
    if (!this.globalFacultyBusy.has(facultyId)) {
      this.globalFacultyBusy.set(facultyId, Array.from({ length: 6 }, () => Array(9).fill(false)));
    }
    this.globalFacultyBusy.get(facultyId)![day][period] = true;
    this.sectionBusy.get(section)![day][period] = true;
    
    const trackerKey = `${section}-${subjectId}-${day}`;
    this.subjectDayTracker.set(trackerKey, (this.subjectDayTracker.get(trackerKey) || 0) + 1);
  }

  private findFaculty(subjectId: string, section: number): string {
    const match = this.faculty.find(f => 
      f.allottedSections?.includes(section) && 
      f.subjects?.some(s => subjectId.startsWith(s))
    );
    if (match) return match.id;
    
    // Domain fallbacks
    if (subjectId === 'TRAINING') return 'TRAINING_DEPT';
    if (subjectId.includes('QLR')) return 'QLR_DEPT';
    if (subjectId.includes('OE')) return 'OE_DEPT';
    if (subjectId.includes('PDC-T')) return 'PDC_DEPT';
    
    return 'GENERIC_DEPT';
  }

  public solve(): Timetable {
    this.initMatrices();
    const timetable: Timetable = {};
    const shuffledSections = this.shuffle(this.sections);

    for (const section of shuffledSections) {
      timetable[section] = [];
      const sectionSubjects = this.subjects.filter(s => s.sections?.includes(section));

      // 1. LABS & TUTORIALS (Consecutive blocks)
      const labs = sectionSubjects.filter(s => s.isLabOrTutorial);
      for (const sub of labs) {
        const rawFac = this.findFaculty(sub.id, section);
        const facId = this.getUniqueFacultyId(rawFac, section);
        let remaining = sub.hoursPerWeek;
        
        const days = this.shuffle([0, 1, 2, 3, 4, 5]);
        const blockStarts = [1, 3, 5, 7];

        for (const d of days) {
          if (remaining < 2) break;
          for (const p of this.shuffle(blockStarts)) {
            if (this.canPlace(facId, section, d, p, sub.id) && this.canPlace(facId, section, d, p + 1, sub.id)) {
              this.addEntry(timetable, section, sub.id, rawFac, d, p);
              this.addEntry(timetable, section, sub.id, rawFac, d, p + 1);
              remaining -= 2;
              break;
            }
          }
        }
      }

      // 2. TRAINING (Must be done all in one day - 6 hours)
      const training = sectionSubjects.find(s => s.id === 'TRAINING');
      if (training) {
        const rawFac = 'TRAINING_DEPT';
        const facId = this.getUniqueFacultyId(rawFac, section);
        let placed = false;
        const days = this.shuffle([0, 1, 2, 3, 4, 5]);
        
        for (const d of days) {
          if (placed) break;
          // Check if day has 6 available slots for training
          const availablePeriods = [1, 2, 3, 4, 5, 6, 7, 8].filter(p => this.canPlace(facId, section, d, p, 'TRAINING'));
          
          if (availablePeriods.length >= 6) {
            // Take the first 6 available slots on this day
            const selectedPeriods = availablePeriods.slice(0, 6);
            for (const p of selectedPeriods) {
              this.addEntry(timetable, section, 'TRAINING', rawFac, d, p);
            }
            placed = true;
          }
        }
      }

      // 3. CORE THEORY & SUPPORT
      const theory = sectionSubjects
        .filter(s => !s.isLabOrTutorial && s.id !== 'TRAINING')
        .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);

      for (const sub of theory) {
        const rawFac = this.findFaculty(sub.id, section);
        const facId = this.getUniqueFacultyId(rawFac, section);
        let remaining = sub.hoursPerWeek;
        const days = this.shuffle([0, 1, 2, 3, 4, 5]);
        const periods = [1, 2, 3, 4, 5, 6, 7, 8];

        // Try to distribute 1 per day first
        for (const d of days) {
          if (remaining === 0) break;
          for (const p of this.shuffle(periods)) {
            if (this.canPlace(facId, section, d, p, sub.id)) {
              this.addEntry(timetable, section, sub.id, rawFac, d, p);
              remaining--;
              break;
            }
          }
        }
        // Backfill if needed
        if (remaining > 0) {
          for (const d of days) {
            if (remaining === 0) break;
            for (const p of this.shuffle(periods)) {
              if (this.canPlace(facId, section, d, p, sub.id)) {
                this.addEntry(timetable, section, sub.id, rawFac, d, p);
                remaining--;
                if (remaining === 0) break;
              }
            }
          }
        }
      }
    }
    return timetable;
  }

  private addEntry(tt: Timetable, section: number, subId: string, facId: string, d: number, p: number) {
    if (!tt[section]) tt[section] = [];
    tt[section].push({ subjectId: subId, facultyId: facId, section, day: d, period: p });
    this.markBusy(this.getUniqueFacultyId(facId, section), section, d, p, subId);
  }
}
