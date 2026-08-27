import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pieceSrc } from '@/components/board';
import { button, chip } from '@/components/ui';
import type { MemberRole, PresenceMember } from '@/protocol/ops';

/** A stable, distinct presence colour per member, derived from the id. */
function hueOf(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
}

function Avatar({ member, presenting }: { member: PresenceMember; presenting: boolean }) {
  const hue = hueOf(member.id);
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 shrink-0 animate-pop place-items-center rounded-full border text-micro font-bold uppercase ${
        presenting ? 'border-gold ring-2 ring-gold/35' : 'border-line'
      }`}
      style={{
        backgroundColor: `hsl(${hue} 45% 22%)`,
        color: `hsl(${hue} 80% 78%)`,
      }}
    >
      {initialsOf(member.name)}
    </span>
  );
}

/** How many avatars the strip shows before collapsing the rest into "+N". */
const MAX_VISIBLE = 4;

/**
 * Presence as chrome, not a panel (ADR-0031): the room's members as an
 * avatar strip in the app bar — ambient "who's here" without a sidebar
 * panel. The strip is one button opening a popover with the full member
 * list and its actions (follow the presenter, owner's presenter handoff and
 * promote/demote). `members` is expected pre-sorted (see
 * `selectSortedMembers`).
 */
export default function PresenceStrip({
  members,
  roles,
  presenterId,
  myRole,
  selfId,
  following,
  onFollowChange,
  onSetRole,
  onSetPresenter,
}: {
  members: PresenceMember[];
  roles: Record<string, MemberRole>;
  presenterId: string | null;
  myRole: MemberRole;
  selfId: string | null;
  /** Whether we are mirroring the presenter's board right now. */
  following: boolean;
  onFollowChange: (following: boolean) => void;
  onSetRole: (memberId: string, role: MemberRole) => void;
  /** Hand the presenter mic to a member (owner only). */
  onSetPresenter?: (memberId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (members.length === 0) {
    return null;
  }

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - visible.length;

  return (
    <div className="relative">
      <button
        type="button"
        id="presence-strip"
        data-tour="member-list"
        className="flex h-8 items-center rounded-control border border-transparent pl-1 pr-1.5 transition-colors hover:border-line"
        aria-label={t('room.membersWithCount', { count: members.length })}
        title={t('room.members')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center -space-x-1.5">
          {visible.map((member) => (
            <Avatar key={member.id} member={member} presenting={member.id === presenterId} />
          ))}
        </span>
        {overflow > 0 && (
          <span className="ml-1.5 text-micro font-semibold text-muted tabular-nums">
            +{overflow}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Click-to-close backdrop (aria-hidden; Esc closes too). */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={t('room.members')}
            className="absolute top-full right-0 z-50 mt-1 max-h-[70dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-control border border-line-strong bg-overlay p-1.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]"
            data-testid="presence-popover"
          >
            <ul data-testid="member-list" className="m-0 flex flex-col gap-0.5 p-0">
              {members.map((member) => {
                const role = roles[member.id] ?? 'viewer';
                const isBold = role === 'owner' || role === 'collaborator';
                // The role piece: king > knight > pawn, using the shipped
                // cburnett SVGs — text glyphs like ♚ fall back to a system font.
                const kind = role === 'owner' ? 'k' : role === 'collaborator' ? 'n' : 'p';
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-2 py-1.5 text-ui"
                  >
                    <Avatar member={member} presenting={member.id === presenterId} />
                    <span
                      role="img"
                      aria-label={t(`room.role.${role}`)}
                      title={t(`room.role.${role}`)}
                      className="inline-flex w-4 shrink-0 items-center justify-center"
                    >
                      <img src={pieceSrc({ color: 'w', kind })} alt="" className="h-4 w-4" />
                    </span>
                    <span className={isBold ? 'font-semibold text-ink' : 'text-muted'}>
                      {member.name}
                    </span>
                    {member.id === presenterId && (
                      <span className={chip({ tone: 'gold' })}>{t('room.presenting')}</span>
                    )}
                    {member.id === presenterId && member.id !== selfId && (
                      <button
                        type="button"
                        data-testid="follow-presenter-button"
                        className={button({ intent: 'quiet', size: 'xs', active: following })}
                        aria-label={following ? t('room.following') : t('room.follow')}
                        aria-pressed={following}
                        onClick={() => onFollowChange(!following)}
                      >
                        {following ? `⇢ ${t('room.followingShort')}` : t('room.followShort')}
                      </button>
                    )}
                    {myRole === 'owner' &&
                      onSetPresenter !== undefined &&
                      member.id !== presenterId && (
                        <button
                          type="button"
                          data-testid={`set-presenter-${member.id}`}
                          aria-label={t('room.makePresenter')}
                          title={t('room.makePresenter')}
                          className={`${button({ intent: 'quiet', size: 'xs' })} ml-auto`}
                          onClick={() => onSetPresenter(member.id)}
                        >
                          ⇢
                        </button>
                      )}
                    {myRole === 'owner' && member.id !== selfId && role !== 'owner' && (
                      <button
                        type="button"
                        data-testid={`set-role-${member.id}`}
                        className={`${button({ intent: 'quiet', size: 'xs' })} ${onSetPresenter === undefined ? 'ml-auto' : ''}`}
                        onClick={() =>
                          onSetRole(member.id, role === 'collaborator' ? 'viewer' : 'collaborator')
                        }
                      >
                        {role === 'collaborator' ? t('room.demote') : t('room.promote')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
