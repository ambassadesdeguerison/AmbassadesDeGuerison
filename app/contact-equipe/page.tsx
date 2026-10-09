import AppHeader from '@/components/AppHeader';
import ContactEquipeForm from './ContactEquipeForm';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ContactEquipePage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <>
      <AppHeader />
      <main className="bg-slate-50 px-4 py-10 flex-1 flex items-center justify-center">
        <div className="max-w-lg w-full space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Dites-nous ce qui se passe
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              On lit chaque message. Si besoin, on vous recontacte à l&apos;adresse indiquée.
            </p>
          </div>
          <ContactEquipeForm token={token ?? null} />
        </div>
      </main>
    </>
  );
}
