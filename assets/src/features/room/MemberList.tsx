import { useTranslation } from 'react-i18next';
import { pieceSrc } from '@/components/board';
import { button, chip, panel, panelHeader } from '@/components/ui';
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

/**
 * The member list. `members` is expected to be pre-sorted (see
 * `selectSortedMembers`): owner, collaborators, then viewers, each by name.
 */
export default function MemberList({
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

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-col`}
      data-tour="member-list"
    >
      <div className={panelHeader()}>
        <h2 className="m-0">{t('room.members')}</h2>
        <span className="text-faint tabular-nums">{members.length}</span>
      </div>
      <ul
        data-testid="member-list"
        className="m-0 min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {members.map((member) => {
          const role = roles[member.id] ?? 'viewer';
          const isBold = role === 'owner' || role === 'collaborator';
          // The role piece: king > knight > pawn, using the shipped cburnett
          // SVGs — text glyphs like ♚ would fall back to a system font.
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
              {myRole === 'owner' && onSetPresenter !== undefined && member.id !== presenterId && (
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
        {members.length === 0 && <li className="p-2 text-ui text-faint">...</li>}
      </ul>
    </section>
  );
}
