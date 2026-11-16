/* data.js : 고쳐 보는 곳
 * 이 파일만 바꿔도 내 돌림판이 됩니다. 저장하고 브라우저를 새로 고치면 바로 보여요.
 * 따옴표('')와 쉼표(,)를 지우지 않게 조심하세요.
 */

// 사이트 이름과 한 줄 소개 (탭 제목과 화면 왼쪽 위)
const SITE = {
  title: '오늘은 너로',
  subtitle: '고민될 때 돌리는 돌림판',
};

// 주제 목록. 위 탭에 순서대로 나와요. items는 2~12개
// 예: 회사 근처 식당으로 바꿔 보세요
const PRESETS = [
  { id: 'lunch', name: '점심', question: '오늘 점심은?', items: ['김밥', '라멘', '샐러드', '국밥', '버거', '쌀국수'] },
  { id: 'order', name: '발표 순서', question: '누가 먼저 발표할까?', items: ['1팀', '2팀', '3팀', '4팀'] },
  { id: 'duty', name: '당번', question: '이번 주 당번은?', items: ['1조', '2조', '3조', '4조', '5조'] },
];

// 칸 색. 순서대로 돌아가며 칠해요. 칸 글자는 진한 남색이라 밝은 색만 써 주세요
const COLORS = ['#FFD8A8', '#C3FAE8', '#D0EBFF', '#FCC2D7', '#E5DBFF', '#FFF3BF', '#D3F9D8', '#FFE3E3'];

// 돌아가는 시간(초)과 소리
const SPIN = { seconds: 3.2, sound: true };

// 항목 수와 글자 수 제한
const LIMITS = { min: 2, max: 12, maxLength: 12 };
