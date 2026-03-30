export interface Member {
  id: string;
  generation: number;
  fullName: string;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate?: string;
  biography?: string;
  imageUrl?: string;
  graveLocation?: string;
  relationships?: string;
  relationshipType?: string;
  relatedMemberId?: string;
}

export interface FamilyTree {
  id: string;
  name: string;
  members: Member[];
  coverImage?: string;
  coverText?: string;
}
