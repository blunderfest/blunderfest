import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import type { RoomPresenceMember } from '@/features/room/useRoomChannel';
import type { MemberRole } from '@/protocol/ops';

export default function MemberList({
  members,
  roles,
  presenterId,
  myRole,
  selfId,
  onSetRole,
}: {
  members: RoomPresenceMember[];
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
      <ul className="m-0 flex flex-col gap-2 p-0">
        {members.map((member) => {
          const role = roles[member.id] ?? 'viewer';
          return (
            <li key={member.id} className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full bg-ok" />
              <span className="min-w-0 truncate">{member.name}</span>
              {member.id === presenterId && (
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted">
                  {t('room.presenting')}
                </span>
              )}
              <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted">
                {t(`room.role.${role}`)}
              </span>
              {myRole === 'owner' && member.id !== selfId && role !== 'owner' && (
                <button
                  type="button"
                  data-testid={`set-role-${member.id}`}
                  className="shrink-0 rounded-lg border border-white/10 px-1.5 py-0.5 text-xs text-ink transition-colors hover:border-white/30"
                  onClick={() => onSetRole(member.id, role === 'partner' ? 'viewer' : 'partner')}
                >
                  {role === 'partner' ? t('room.demote') : t('room.promote')}
                </button>
              )}
            </li>
          );
        })}
        {members.length === 0 && <li className="text-sm text-muted">…</li>}
      </ul>
    </section>
  );
}
