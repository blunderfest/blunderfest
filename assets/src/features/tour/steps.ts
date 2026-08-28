/**
 * Guided-tour step definitions. Each step spotlights one element (a CSS
 * selector) or, with `target: null`, floats centered as a pure text card.
 * Steps whose target is absent from the DOM are skipped when the tour
 * opens, so one list serves every room state (empty, demo, mid-game).
 * Room-only by design: the landing page is simple enough to not need one.
 * Copy lives in en.json under `tour.*` (ADR-0003: the client owns copy).
 *
 * Since ADR-0031 the steps anchor to always-visible chrome (the board, the
 * sidebar strip, the app bar) — never at tab *content*: hidden tab panels
 * stay mounted but measure 0, which would misplace the spotlight. ADR-0032
 * adds the games rail as chrome; the sidebar strip still owns the tabbed
 * panels.
 */
export type TourStepDef = {
  target: string | null;
  titleKey: string;
  bodyKey: string;
};

export const roomSteps: TourStepDef[] = [
  { target: '[data-tour="board"]', titleKey: 'tour.boardTitle', bodyKey: 'tour.boardBody' },
  {
    target: '[data-tour="games-rail"]',
    titleKey: 'tour.gamesRailTitle',
    bodyKey: 'tour.gamesRailBody',
  },
  {
    target: '[data-tour="sidebar"]',
    titleKey: 'tour.analysisPanelTitle',
    bodyKey: 'tour.analysisPanelBody',
  },
  {
    target: '[data-tour="timeline-band"]',
    titleKey: 'tour.timelineBandTitle',
    bodyKey: 'tour.timelineBandBody',
  },
  {
    target: '[data-tour="share"]',
    titleKey: 'tour.roomPanelTitle',
    bodyKey: 'tour.roomPanelBody',
  },
  {
    target: '[data-tour="member-list"]',
    titleKey: 'tour.memberListTitle',
    bodyKey: 'tour.memberListBody',
  },
  { target: '[data-tour="help-menu"]', titleKey: 'tour.helpTitle', bodyKey: 'tour.helpBody' },
];
