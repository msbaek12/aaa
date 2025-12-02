import { GoogleGenAI } from "@google/genai";
import { MissionLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getMissionBriefing = async (level: MissionLevel, weather: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `당신은 사회적 불안을 겪는 사용자를 돕는 따뜻하고 격려하는 AI 동반자입니다.
      사용자가 레벨 ${level} 미션을 시작하려고 합니다.
      현재 날씨는 ${weather}입니다.
      
      레벨 1: 현관 밖 10m 나가기.
      레벨 2: 근처 공원이나 편의점 가기.
      레벨 3: 도서관이나 카페에 가서 30분 머물기.

      미션을 시작하기 전, 아주 짧고 따뜻한 한 문장의 동기 부여 메시지를 한국어로 작성해주세요. 강압적이지 않게 해주세요.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error", error);
    return "새로운 시공간 좌표를 탐험할 준비가 되셨나요?";
  }
};

export const getPanicSupport = async () => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `사용자가 외출 중 공황 발작이나 불안을 느껴 "긴급 귀환" 버튼을 눌렀습니다.
      차분하고 안정감을 주는 안전한 한 문장의 메시지를 한국어로 작성해주세요. 집에 가도 괜찮고, 시도한 것만으로도 잘했다고 말해주세요.`,
    });
    return response.text;
  } catch (error) {
    return "괜찮습니다. 천천히 집으로 돌아가도 좋아요. 깊게 숨을 쉬세요.";
  }
};

export const getMissionSuccessMessage = async (level: MissionLevel) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `사용자가 레벨 ${level} 미션을 성공적으로 완료했습니다.
      따뜻함과 SF 게임의 "업적 달성" 스타일을 섞어 짧은 축하 메시지를 한국어로 작성해주세요.`,
    });
    return response.text;
  } catch (error) {
    return "미션 완료. 해당 구역의 시공간 잠금이 해제되었습니다.";
  }
};