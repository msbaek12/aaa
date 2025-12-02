
export interface Coordinate {
  lat: number;
  lng: number;
}

export enum MissionLevel {
  LEVEL_1_FRESH_AIR = 1,
  LEVEL_2_NEIGHBORHOOD = 2,
  LEVEL_3_SOCIAL_SPACE = 3,
}

export interface Mission {
  id: string;
  level: MissionLevel;
  title: string;
  description: string;
  targetLocation?: Coordinate; // Level 1 might not have a fixed target, just "away from home"
  radiusMeters: number;
  requiredDurationSeconds: number; // For level 3
  timeWindowStart: string; // "09:00"
  timeWindowEnd: string; // "10:00"
}

export interface UserState {
  currentLocation: Coordinate | null;
  homeLocation: Coordinate | null;
  visitedPath: Coordinate[]; // For Fog of War
  currentLevel: MissionLevel;
  missionStatus: 'idle' | 'briefing' | 'active' | 'success' | 'failed' | 'panic' | 'completed_all';
  missionStartTime: number | null;
  inZoneSince: number | null; // For tracking duration stay
  ghostTime: string | null; // Yesterday's completion time
}

export const MOCK_HOME: Coordinate = { lat: 37.5665, lng: 126.9780 }; // 서울 시청 예시
export const MOCK_LIBRARY: Coordinate = { lat: 37.5670, lng: 126.9790 }; // 근처 도서관
export const MOCK_PARK: Coordinate = { lat: 37.5650, lng: 126.9770 }; // 근처 공원
