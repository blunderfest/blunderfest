/**
 * Guided-tour step definitions. Each step spotlights one element (a CSS
 * selector) or, with `target: null`, floats centered as a pure text card.
 * Steps whose target is absent from the DOM are skipped when the tour
 * opens, so one list serves every room state (empty, demo, mid-game).
 * Copy lives in en.json under `tour.*` (ADR-0003: the client owns copy).
 */
export type TourStepDef = {
  target: string | null;
  titleKey: string;
  bodyKey: string;
};

export const homeSteps: TourStepDef[] = [
  { target: null, titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody' },
  {
    target: '#create-room-button',
    titleKey: 'tour.homeCreateTitle',
    bodyKey: 'tour.homeCreateBody',
  },
  { target: '#join-code-input', titleKey: 'tour.homeJoinTitle', bodyKey: 'tour.homeJoinBody' },
  { target: '#demo-room-link', titleKey: 'tour.homeDemoTitle', bodyKey: 'tour.homeDemoBody' },
  { target: '[data-tour="help-menu"]', titleKey: 'tour.helpTitle', bodyKey: 'tour.helpBody' },
];

export const roomSteps: TourStepDef[] = [
  { target: '[data-tour="board"]', titleKey: 'tour.boardTitle', bodyKey: 'tour.boardBody' },
  {
    target: '[data-tour="analysis-panel"]',
    titleKey: 'tour.analysisPanelTitle',
    bodyKey: 'tour.analysisPanelBody',
  },
  { target: '[data-tour="viz-box"]', titleKey: 'tour.vizBoxTitle', bodyKey: 'tour.vizBoxBody' },
  {
    target: '[data-tour="room-panel"]',
    titleKey: 'tour.roomPanelTitle',
    bodyKey: 'tour.roomPanelBody',
  },
  {
    target: '[data-tour="game-list"]',
    titleKey: 'tour.gameListTitle',
    bodyKey: 'tour.gameListBody',
  },
  {
    target: '[data-tour="member-list"]',
    titleKey: 'tour.memberListTitle',
    bodyKey: 'tour.memberListBody',
  },
  { target: '[data-tour="help-menu"]', titleKey: 'tour.helpTitle', bodyKey: 'tour.helpBody' },
];
