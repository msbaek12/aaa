
import React from 'react';
import { Mission, MissionLevel, UserState } from '../types';
import { Timer, MapPin, Ghost } from 'lucide-react';

interface MissionCardProps {
  mission: Mission;
  userState: UserState;
  remainingTime?: number; // For level 3 stay duration
  distanceToTarget?: number;
}

const MissionCard: React.FC<MissionCardProps> = ({ mission, userState, remainingTime, distanceToTarget }) => {
  // Safety check for NaN or undefined distance to prevent rendering errors
  const safeDistance = distanceToTarget !== undefined && !isNaN(distanceToTarget) ? Math.round(distanceToTarget) : null;
  
  // Progress Bar Logic
  // Level 1: Distance is "remaining distance to boundary" (Max ~20m). 
  // Level 2/3: Distance is "distance to target" (Max ~500m heuristic).
  let progressPercent = 0;
  if (safeDistance !== null) {
      const isShortRange = mission.level === MissionLevel.LEVEL_1_FRESH_AIR;
      const maxDistance = isShortRange ? 20 : 500; // 20m for Level 1, 500m for others
      
      // Formula: 100% - (CurrentDistance / MaxDistance * 100)
      // Level 1 Example: At start, dist=20. (20/20)*100 = 100. 100-100 = 0% progress.
      // Level 1 Example: Success, dist=0. (0/20)*100 = 0. 100-0 = 100% progress.
      progressPercent = Math.min(100, Math.max(0, 100 - ((safeDistance / maxDistance) * 100)));
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl"></div>

      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-cyan-900 text-cyan-300 mb-1 border border-cyan-700/50">
            LEVEL {mission.level}
          </span>
          <h2 className="text-xl font-bold text-white">{mission.title}</h2>
        </div>
        <div className="flex flex-col items-end">
           <span className="text-xs text-slate-400 font-mono">TIME WINDOW</span>
           <span className="text-sm font-semibold text-cyan-400">{mission.timeWindowStart} - {mission.timeWindowEnd}</span>
        </div>
      </div>

      <p className="text-sm text-slate-300 mb-4 leading-relaxed break-keep">
        {mission.description}
      </p>

      {/* Dynamic Status Area */}
      <div className="space-y-3">
        
        {/* Distance Indicator */}
        <div className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-lg">
           <MapPin className="w-5 h-5 text-emerald-400" />
           <div className="flex-1">
             <div className="flex justify-between text-xs mb-1">
               <span className="text-slate-400">목표까지 거리</span>
               <span className="text-emerald-300 font-mono">
                 {safeDistance !== null ? `${safeDistance}m` : '계산 중...'}
               </span>
             </div>
             <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
               <div 
                 className="bg-emerald-500 h-full transition-all duration-500" 
                 style={{ width: `${progressPercent}%` }}
               ></div>
             </div>
           </div>
        </div>

        {/* Ghost Pacing */}
        {userState.ghostTime && (
           <div className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-lg border border-purple-900/30">
             <Ghost className="w-5 h-5 text-purple-400" />
             <div className="text-xs text-purple-200">
               <span className="block font-bold text-purple-400">고스트 페이스</span>
               어제의 나: {userState.ghostTime} 도착. 이길 수 있나요?
             </div>
           </div>
        )}

        {/* Timer (Level 3 specific) */}
        {mission.level === MissionLevel.LEVEL_3_SOCIAL_SPACE && (
          <div className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-lg">
             <Timer className={`w-5 h-5 ${remainingTime && remainingTime > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
             <div className="flex-1">
               <div className="flex justify-between text-xs">
                 <span className="text-slate-400">필요 체류 시간</span>
                 <span className="text-amber-300 font-mono font-bold">
                    {remainingTime ? `${Math.floor(remainingTime / 60)}분 ${remainingTime % 60}초` : '00:00'}
                 </span>
               </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MissionCard;
