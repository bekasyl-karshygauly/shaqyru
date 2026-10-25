import {invitationSlug,invitationPath,validInvitationSlug} from './public/invitation-links.js';

export function createInvitationLinks({sb,inv}){
  async function slugFor(id){const rows=await sb(`/shq_invitation_slugs?inv=eq.${id}&select=slug&limit=1`);return rows[0]?.slug||null}
  return {
    async path(id){try{return invitationPath(id,await slugFor(id))}catch{return invitationPath(id)}},
    async ensure(i){
      const slug=await sb('/rpc/shq_allocate_invitation_slug',{method:'POST',body:{p_inv:i.id,p_base:invitationSlug(i.data.names)}});
      if(!validInvitationSlug(slug))throw Object.assign(new Error('Не удалось создать адрес приглашения'),{status:503});
      return {slug,path:invitationPath(i.id,slug)};
    },
    async resolve(slug){
      if(!validInvitationSlug(slug))return null;
      const rows=await sb(`/shq_invitation_slugs?slug=eq.${slug}&select=inv&limit=1`);return rows[0]?inv(rows[0].inv):null;
    }
  };
}
