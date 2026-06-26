import { useSession } from './lib/useSession';
import { Login, VerificandoSessao } from './screens/Login';
import { Home } from './screens/Home';

export default function App() {
  const { session, loading } = useSession();

  if (loading) return <VerificandoSessao />;   // verificando sessão (§6)
  if (!session) return <Login />;               // tela dedicada até logar
  return <Home />;                              // sessão ativa → app
}
