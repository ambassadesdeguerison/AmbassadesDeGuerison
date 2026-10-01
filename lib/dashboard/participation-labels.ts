// Libellés de la participation d'un ambassadeur à un live, selon le lieu qu'il ouvre.
// Ton volontairement chaleureux et sans culpabilisation côté désistement (principe de confiance).

export interface ParticipationLabels {
  join: string;
  joined: string;
  leave: string;
  /** Rappel dans la carte « Mission du moment », à citer entre guillemets. */
  reminder: string;
}

export function participationLabels(hostType: string | null | undefined): ParticipationLabels {
  if (hostType === 'church') {
    return {
      join: "J'ouvre mon église pour ce live",
      joined: 'Votre église est ouverte pour ce live',
      leave: 'Finalement, je ne peux pas accueillir',
      reminder: "J'ouvre mon église pour ce live",
    };
  }
  return {
    join: "J'ouvre ma maison pour ce live",
    joined: 'Votre maison est ouverte pour ce live',
    leave: 'Finalement, je ne peux pas accueillir',
    reminder: "J'ouvre ma maison pour ce live",
  };
}
