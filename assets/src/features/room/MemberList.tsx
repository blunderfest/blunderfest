import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import type { MemberRole, PresenceMember } from '@/protocol/ops';

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
  onSetRole,
}: {
  members: PresenceMember[];
  roles: Record<string, MemberRole>;
  presenterId: string | null;
  myRole: MemberRole;
  selfId: string | null;
  onSetRole: (memberId: string, role: MemberRole) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={panel({ layout: 'none', padding: 'tight' })}>
      <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.members')}</h2>
      <ul data-testid="member-list" className="m-0 flex flex-col gap-2 p-0">
        {members.map((member) => {
          const role = roles[member.id] ?? 'viewer';
          const isBold = role === 'owner' || role === 'collaborator';
          const icon = role === 'owner' ? '♔' : role === 'collaborator' ? '♘' : '♙';
          const iconClass =
            role === 'owner'
              ? 'text-warn'
              : role === 'collaborator'
                ? 'text-slate-400'
                : 'text-muted';
          return (
            <li key={member.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span role="img" aria-label={t(`room.role.${role}`)} className={iconClass}>
                {icon}
              </span>
              <span className={isBold ? 'font-semibold' : undefined}>{member.name}</span>
              {member.id === presenterId && (
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted">
                  {t('room.presenting')}
                </span>
              )}
              {myRole === 'owner' && member.id !== selfId && role !== 'owner' && (
                <button
                  type="button"
                  data-testid={`set-role-${member.id}`}
                  className="ml-auto shrink-0 rounded-lg border border-white/10 px-1.5 py-0.5 text-xs text-ink transition-colors hover:border-white/30"
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
        {members.length === 0 && <li className="text-sm text-muted">...</li>}
      </ul>
    </section>
  );
}
