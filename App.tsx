
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FogMap from './components/FogMap';
import MissionCard from './components/MissionCard';
import { Mission, MissionLevel, UserState, Coordinate, MOCK_LIBRARY, MOCK_PARK } from './types';
import { calculateDistance } from './utils/geo';
import { getMissionBriefing, getPanicSupport, getMissionSuccessMessage } from './services/geminiService';
import { AlertTriangle, Home, CheckCircle2, Lock, ArrowRight, Loader2, Moon } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [userState, setUserState] = useState<UserState>({
    currentLocation: null, // 초기값 null (GPS 수신 대기)
    homeLocation: null,    // 초기값 null (첫 위치를 집으로 설정)
    visitedPath: [],
    currentLevel: MissionLevel.LEVEL_1_FRESH_AIR,
    missionStatus: 'briefing',
    missionStartTime: null,
    inZoneSince: null,
    ghostTime: "09:15",
  });

  const [aiMessage, setAiMessage] = useState<string>("시공간 시퀀스 동기화 중...");
  const [panicMode, setPanicMode] = useState(false);
  const [stayTimer, setStayTimer] = useState<number>(0);
  
  const timerRef = useRef<number | null>(null);

  // --- DERIVED STATE (Fix for "Looping back to Level 1" bug) ---
  // 미션 정보를 State가 아닌 Derived Value로 관리하여 레벨 변경 시 즉시 반영되도록 함
  const currentMission: Mission = useMemo(() => {
    switch (userState.currentLevel) {
      case MissionLevel.LEVEL_1_FRESH_AIR:
        return {
          id: 'm1',
          level: MissionLevel.LEVEL_1_FRESH_AIR,
          title: '1단계: 바깥 공기 마시기',
          description: 'GPS가 집 위치를 인식했습니다. 현관문을 열고 20m만 걸어 나가보세요.',
          radiusMeters: 20, // GPS 오차 고려하여 10m -> 20m 상향
          timeWindowStart: '09:00',
          timeWindowEnd: '23:00',
          requiredDurationSeconds: 0,
          targetLocation: undefined // 1단계는 '집에서 멀어지기'이므로 타겟 없음
        };
      case MissionLevel.LEVEL_2_NEIGHBORHOOD:
        return {
          id: 'm2',
          level: MissionLevel.LEVEL_2_NEIGHBORHOOD,
          title: '2단계: 동네 정찰',
          description: '안개를 걷어내기 위해 지정된 포인트(공원)까지 이동하세요.',
          targetLocation: MOCK_PARK,
          radiusMeters: 30,
          requiredDurationSeconds: 0,
          timeWindowStart: '10:00',
          timeWindowEnd: '14:00'
        };
      case MissionLevel.LEVEL_3_SOCIAL_SPACE:
        return {
          id: 'm3',
          level: MissionLevel.LEVEL_3_SOCIAL_SPACE,
          title: '3단계: 사회적 앵커',
          description: '도서관에 방문하여 30초간 머무르세요. (사회적응 훈련)',
          targetLocation: MOCK_LIBRARY,
          radiusMeters: 50,
          requiredDurationSeconds: 30,
          timeWindowStart: '09:00',
          timeWindowEnd: '12:00'
        };
      default:
        // Fallback to Level 1
        return {
           id: 'm1',
           level: MissionLevel.LEVEL_1_FRESH_AIR,
           title: '1단계: 바깥 공기 마시기',
           description: '오류 복구됨. 1단계부터 다시 시작합니다.',
           radiusMeters: 20,
           requiredDurationSeconds: 0,
           timeWindowStart: '09:00',
           timeWindowEnd: '23:00'
        };
    }
  }, [userState.currentLevel]);


  // --- LOGIC ---

  // 1. Initial AI Briefing
  useEffect(() => {
    // 완료 상태면 브리핑 생략
    if (userState.missionStatus === 'completed_all') return;

    const fetchBriefing = async () => {
        setAiMessage("통신 연결 중...");
        const msg = await getMissionBriefing(userState.currentLevel, "맑음, 22°C");
        setAiMessage(msg);
        
        // 레벨 3일 때 타이머 초기화
        if (userState.currentLevel === MissionLevel.LEVEL_3_SOCIAL_SPACE) {
            setStayTimer(30);
        }
    };
    fetchBriefing();
  }, [userState.currentLevel, userState.missionStatus]);

  // 2. Geolocation Watcher (핵심 수정: Home 위치 동적 설정)
  useEffect(() => {
    if (!navigator.geolocation) {
      setAiMessage("GPS를 사용할 수 없는 기기입니다.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newCoord = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        setUserState(prev => {
           // *** FIX 1: 첫 위치를 Home으로 설정 (자동 클리어 방지) ***
           if (!prev.homeLocation) {
             return {
               ...prev,
               currentLocation: newCoord,
               homeLocation: newCoord,
               visitedPath: [newCoord]
             };
           }

           // 경로 기록 (미션 중이고 5m 이상 이동 시)
           const lastPos = prev.visitedPath[prev.visitedPath.length - 1];
           const dist = calculateDistance(lastPos, newCoord);
           const shouldAddPath = dist > 5 && prev.missionStatus === 'active';
           
           const newPath = shouldAddPath ? [...prev.visitedPath, newCoord] : prev.visitedPath;

           return {
             ...prev,
             currentLocation: newCoord,
             visitedPath: newPath
           };
        });
      },
      (err) => {
        console.error(err);
        setAiMessage("GPS 신호를 찾을 수 없습니다. 탁 트인 공간으로 이동해주세요.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const handleSuccess = useCallback(async () => {
      // 이미 성공 상태면 중복 실행 방지
      if (userState.missionStatus === 'success' || userState.missionStatus === 'completed_all') return;
      
      if (timerRef.current) clearInterval(timerRef.current);

      const msg = await getMissionSuccessMessage(currentMission.level);
      setAiMessage(msg);
      setUserState(prev => ({ ...prev, missionStatus: 'success' }));
  }, [userState.missionStatus, currentMission.level]);

  // 3. Mission Validation Logic
  useEffect(() => {
    // 필수 조건: 미션 활성화 상태, GPS 좌표 존재, 홈 위치 설정 완료
    if (userState.missionStatus !== 'active' || !userState.currentLocation || !userState.homeLocation || panicMode) return;

    let success = false;

    // LEVEL 1: 집에서 설정된 반경(20m) 밖으로 나가기
    if (currentMission.level === MissionLevel.LEVEL_1_FRESH_AIR) {
        const distToHome = calculateDistance(userState.currentLocation, userState.homeLocation);
        
        if (distToHome > currentMission.radiusMeters) {
            success = true;
        }
    }

    // LEVEL 2: 목표 지점 도달
    if (currentMission.level === MissionLevel.LEVEL_2_NEIGHBORHOOD && currentMission.targetLocation) {
        const distToTarget = calculateDistance(userState.currentLocation, currentMission.targetLocation);
        if (distToTarget < currentMission.radiusMeters) {
            success = true;
        }
    }

    // LEVEL 3: 체류 (Timer Logic)
    if (currentMission.level === MissionLevel.LEVEL_3_SOCIAL_SPACE && currentMission.targetLocation) {
        const distToTarget = calculateDistance(userState.currentLocation, currentMission.targetLocation);
        const inZone = distToTarget < currentMission.radiusMeters;
        
        if (inZone) {
            if (!timerRef.current) {
               timerRef.current = window.setInterval(() => {
                  setStayTimer(prev => {
                      if (prev <= 1) {
                          handleSuccess();
                          return 0;
                      }
                      return prev - 1;
                  });
               }, 1000);
            }
        } else {
            // 구역 이탈 시 타이머 정지 (혹은 리셋)
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    } else {
        // 즉시 완료 미션 (Level 1, 2)
        if (success) {
            handleSuccess();
        }
    }

  }, [userState.currentLocation, currentMission, panicMode, userState.missionStatus, userState.homeLocation, handleSuccess]);

  const handlePanic = async () => {
      setPanicMode(true);
      setUserState(prev => ({ ...prev, missionStatus: 'panic' }));
      const msg = await getPanicSupport();
      setAiMessage(msg);
  };

  const nextLevel = (e: React.MouseEvent) => {
      e.preventDefault(); // 중요: 기본 동작(새로고침 등) 방지
      
      if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
      }

      // Check if it's the final level (Level 3)
      if (userState.currentLevel === MissionLevel.LEVEL_3_SOCIAL_SPACE) {
          // End of daily missions
          setUserState(prev => ({ ...prev, missionStatus: 'completed_all' }));
          return;
      }

      // Move to next level
      const next = userState.currentLevel + 1;
      
      setUserState(prev => ({
          ...prev,
          currentLevel: next as MissionLevel,
          missionStatus: 'briefing', 
          // Re-initialize path with Home location only to prevent empty Polyline crash
          visitedPath: prev.homeLocation ? [prev.homeLocation] : [], 
      }));
      setPanicMode(false);
  };

  const startMission = () => {
    setUserState(prev => ({ ...prev, missionStatus: 'active' }));
  };

  const getDistanceToTarget = () => {
      if (!userState.currentLocation) return undefined;
      // Level 1: Return REMAINING distance to the boundary (20m radius)
      if (currentMission.level === MissionLevel.LEVEL_1_FRESH_AIR && userState.homeLocation) {
          const distFromHome = calculateDistance(userState.currentLocation, userState.homeLocation);
          // If we are 5m from home, remaining distance to break the 20m barrier is 15m.
          return Math.max(0, currentMission.radiusMeters - distFromHome);
      }
      // Level 2 & 3: Return distance to the specific target location
      if (currentMission.targetLocation) {
          return calculateDistance(userState.currentLocation, currentMission.targetLocation);
      }
      return undefined;
  };

  // --- LOADING SCREEN ---
  if (!userState.homeLocation || !userState.currentLocation) {
     return (
        <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-cyan-500 space-y-4">
           <Loader2 className="w-12 h-12 animate-spin" />
           <p className="font-mono text-sm animate-pulse">GPS 위성 신호 수신 중...</p>
           <p className="text-xs text-slate-500">현재 위치를 '집(Safe Zone)'으로 설정합니다.</p>
           {/* Fallback for testing if GPS fails */}
           <button 
             onClick={() => {
                const fakeStart = { lat: 37.5665, lng: 126.9780 };
                setUserState(p => ({ ...p, currentLocation: fakeStart, homeLocation: fakeStart }));
             }}
             className="mt-8 text-[10px] text-slate-700 underline hover:text-slate-400"
           >
             (GPS가 안 잡히나요? 테스트용 위치 강제 설정)
           </button>
        </div>
     );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 relative overflow-hidden font-sans">
      
      {/* 1. COMPLETED ALL SCREEN (Daily End) */}
      {userState.missionStatus === 'completed_all' && (
        <div className="absolute inset-0 z-[4000] bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
           <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(34,211,238,0.2)]">
                <Moon className="w-12 h-12 text-cyan-200" />
           </div>
           
           <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 mb-4">
              ALL SYSTEMS OFFLINE
           </h1>
           
           <p className="text-xl text-slate-300 font-light mb-2">
              오늘의 할당량을 모두 완수했습니다.
           </p>
           
           <p className="text-slate-500 max-w-md break-keep leading-relaxed">
              훌륭한 여정이었습니다. 이제 충분한 휴식을 취하고, 
              내일 새로운 태양과 함께 다시 만나요.
           </p>

           <div className="mt-12 opacity-50 text-[10px] font-mono text-slate-600">
              SESSION ENDED // {new Date().toLocaleTimeString()}
           </div>
        </div>
      )}

      {/* 2. BRIEFING SCREEN (OVERLAY) */}
      {userState.missionStatus === 'briefing' && (
        <div className="absolute inset-0 z-[3000] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="max-w-md w-full space-y-8">
              <div className="text-center">
                  <span className="inline-block px-3 py-1 bg-cyan-900/50 text-cyan-400 text-xs tracking-[0.2em] font-bold border border-cyan-800 rounded-full mb-4">
                    MISSION SEQUENCE {userState.currentLevel}
                  </span>
                  <h1 className="text-4xl font-black text-white mb-2 leading-tight">
                    {currentMission.title}
                  </h1>
                  <p className="text-slate-400 text-lg">
                    {currentMission.description}
                  </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                     <span className="text-slate-500">목표 시간</span>
                     <span className="text-cyan-400 font-mono text-xl">{currentMission.timeWindowStart} - {currentMission.timeWindowEnd}</span>
                  </div>
                  <div className="flex items-start space-x-3">
                     <div className="bg-slate-800 p-2 rounded-lg">
                        <Lock className="w-5 h-5 text-slate-400" />
                     </div>
                     <div>
                        <p className="text-slate-300 text-sm font-medium">시공간 잠금 상태</p>
                        <p className="text-slate-500 text-xs mt-1">
                            {currentMission.level === 1 
                                ? "현재 위치(집)에서 20m 이상 이동하여 잠금을 해제하세요." 
                                : "목표 지점까지 이동하여 안개를 걷어내세요."}
                        </p>
                     </div>
                  </div>
              </div>

              <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 p-4 rounded-xl border-l-4 border-cyan-500">
                 <p className="text-cyan-200 text-sm italic">"{aiMessage}"</p>
                 <p className="text-cyan-600 text-[10px] mt-2 font-bold text-right">- AI NAVIGATOR</p>
              </div>

              <button 
                onClick={startMission}
                className="group w-full bg-white hover:bg-slate-200 text-slate-950 font-black py-5 rounded-xl text-xl flex items-center justify-center space-x-2 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                 <span>미션 시작</span>
                 <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>
      )}

      {/* HEADER */}
      <div className="z-10 p-4 bg-slate-950/80 backdrop-blur border-b border-slate-800 flex justify-between items-center shadow-md">
        <div>
           <h1 className="text-lg font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase italic">
             Space-Time Unlock
           </h1>
        </div>
        <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${userState.missionStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
            <span className="text-xs font-bold text-slate-400">
               {userState.missionStatus === 'active' ? 'GPS 연결됨' : '대기중'}
            </span>
        </div>
      </div>

      {/* MAP LAYER */}
      <div className="flex-1 relative w-full">
         <FogMap 
            userLocation={userState.currentLocation}
            visitedPath={userState.visitedPath}
            targetLocation={currentMission.targetLocation}
            targetRadius={currentMission.radiusMeters}
            isPanicMode={panicMode}
         />

         {/* PANIC BUTTON */}
         {!panicMode && userState.missionStatus === 'active' && (
             <button 
                onClick={handlePanic}
                className="absolute top-4 right-4 z-[2000] bg-slate-900 text-red-500 border border-red-900/50 p-3 rounded-full shadow-lg hover:bg-red-950 hover:text-red-400 transition-all active:scale-95 group"
             >
                <AlertTriangle className="w-6 h-6" />
                <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-slate-900 text-red-500 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-red-900/50">
                    긴급 귀환
                </span>
             </button>
         )}

         {/* AI MESSAGE TOAST */}
         {userState.missionStatus === 'active' && (
            <div className="absolute bottom-6 left-4 right-4 z-[1500] pointer-events-none flex justify-center">
                <div className="bg-slate-900/95 backdrop-blur border-l-4 border-cyan-500 p-4 rounded-r shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom-2">
                    <p className="text-xs font-mono text-cyan-500 mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                        AI NAVIGATOR
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed break-keep">{aiMessage}</p>
                </div>
            </div>
         )}
      </div>

      {/* BOTTOM CONTROL PANEL */}
      <div className="z-20 bg-slate-950 border-t border-slate-800 p-4 pb-8">
         
         {panicMode ? (
             <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <Home className="w-12 h-12 text-red-400 mx-auto mb-4" />
                 <h2 className="text-2xl font-bold text-red-200 mb-2">귀환 프로토콜 가동</h2>
                 <p className="text-red-300 mb-6 text-sm break-keep">집으로 가는 가장 빠른 안전 경로를 탐색했습니다. 패널티는 없습니다. 용기 있는 선택이었습니다.</p>
                 <button 
                   onClick={() => window.location.reload()}
                   className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-red-900/20"
                 >
                    시스템 재설정
                 </button>
             </div>
         ) : userState.missionStatus === 'success' ? (
             <div className="bg-emerald-900/10 border border-emerald-500/30 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-500">
                 <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                 <h2 className="text-2xl font-bold text-emerald-200 mb-2">미션 완료</h2>
                 <p className="text-emerald-300 mb-6 text-sm break-keep">시공간 좌표가 성공적으로 해제되었습니다. 새로운 영역이 지도에 기록되었습니다.</p>
                 <button 
                   onClick={nextLevel}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                 >
                    다음 레벨 진입
                 </button>
             </div>
         ) : (
             <MissionCard 
                mission={currentMission} 
                userState={userState}
                distanceToTarget={getDistanceToTarget()}
                remainingTime={stayTimer}
             />
         )}

         {/* DEBUG CONTROLS - Teleport logic updated to support Home-based missions */}
         {userState.missionStatus !== 'completed_all' && (
           <div className="mt-6 flex justify-center space-x-2 opacity-30 hover:opacity-100 transition-opacity">
               <button onClick={() => setUserState(p => {
                   if (!p.currentLocation) return p;
                   return {...p, currentLocation: { lat: p.currentLocation.lat + 0.0001, lng: p.currentLocation.lng }};
               })} className="text-[10px] bg-slate-800 px-3 py-2 rounded border border-slate-700">북쪽 이동</button>
               
               <button onClick={() => setUserState(p => {
                   if (!p.currentLocation) return p;
                   return {...p, currentLocation: { lat: p.currentLocation.lat, lng: p.currentLocation.lng + 0.0001 }};
               })} className="text-[10px] bg-slate-800 px-3 py-2 rounded border border-slate-700">동쪽 이동</button>
               
               <button onClick={() => {
                   // Teleport target logic
                   let target = currentMission.targetLocation;
                   // If level 1 (no target), teleport 30m away from home to simulate success
                   if (!target && userState.homeLocation) {
                       target = { lat: userState.homeLocation.lat + 0.0003, lng: userState.homeLocation.lng + 0.0003 };
                   }
                   if (target) {
                      setUserState(p => ({...p, currentLocation: target! }));
                   }
               }} className="text-[10px] bg-slate-800 px-3 py-2 rounded text-cyan-400 border border-slate-700">
                   {currentMission.level === 1 ? '성공 위치로 이동' : '목표로 이동'}
               </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default App;
