import PulseBoardBrand from "@/components/PulseBoardBrand";

export function Privacy() {
  return <LegalPage title="Politique de confidentialité">
    <p>Version bêta — mise à jour du 12 août 2026.</p>
    <h2>Données traitées</h2><p>PulseBoard traite les informations de compte, le rôle déclaré, les journaux de sécurité et les données saisies dans le carnet ou les espaces de service. Les nouveaux dossiers identifient les patients uniquement par leurs initiales. Le carnet personnel ne conserve ni téléphone ni date de naissance.</p>
    <h2>Finalités et accès</h2><p>Ces données servent à fournir le carnet de stage, coordonner une équipe autorisée, sécuriser les comptes et gérer les abonnements. Les dossiers collectifs restent visibles uniquement aux membres du service concerné selon leurs autorisations.</p>
    <h2>Conservation et droits</h2><p>Vous pouvez exporter les données de votre carnet et demander la suppression du compte depuis le profil. Une demande de suppression est vérifiée avant exécution afin d'éviter une perte ou une suppression frauduleuse.</p>
    <h2>Données de santé</h2><p>N'utilisez la version bêta qu'avec des données fictives ou correctement anonymisées tant que les formalités réglementaires, les contrats avec les établissements et l'hébergement de production n'ont pas été validés.</p>
    <h2>Contact</h2><p>Le responsable et l'adresse de contact définitifs doivent être renseignés avant l'ouverture publique.</p>
  </LegalPage>;
}

export function Terms() {
  return <LegalPage title="Conditions d'utilisation">
    <p>Version bêta — mise à jour du 12 août 2026.</p>
    <h2>Objet</h2><p>PulseBoard est un outil d'organisation et de documentation de stage. Il ne remplace ni le dossier médical officiel, ni les protocoles de l'établissement, ni le jugement d'un professionnel habilité.</p>
    <h2>Responsabilités</h2><p>L'utilisateur confirme disposer de l'autorisation nécessaire pour accéder à un service et saisir une information. Il doit éviter toute identité complète dans le carnet personnel et protéger ses identifiants.</p>
    <h2>Offres</h2><p>L'essai gratuit permet jusqu'à trois cas anonymisés et une rotation. Le Carnet Pro est proposé à 3 000 FCFA par mois et Hall + Carnet à 5 000 FCFA par utilisateur et par mois. Le paiement ne devient effectif qu'après confirmation par PulseBoard.</p>
    <h2>Bêta</h2><p>La disponibilité, le support, les modalités de remboursement et l'identité commerciale finale seront précisés avant la vente au public.</p>
  </LegalPage>;
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f7f8f6] p-5"><article className="max-w-3xl mx-auto bg-white border rounded-3xl p-6 md:p-10 shadow-sm"><a href="/" className="inline-block mb-8"><PulseBoardBrand /></a><h1 className="text-3xl font-bold mb-6">{title}</h1><div className="space-y-4 text-sm leading-7 text-muted-foreground [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:pt-3">{children}</div></article></main>;
}
