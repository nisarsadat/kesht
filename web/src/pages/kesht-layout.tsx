import { Navigate, Outlet, useParams } from 'react-router-dom';
import { KeshtTabBar } from '../components/tab-bar';
import { useBundle } from '../state/app-state';

export function KeshtLayout() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);

  if (!bundle) return <Navigate to="/" replace />;

  return (
    <>
      <Outlet />
      <KeshtTabBar keshtId={bundle.kesht.id} />
    </>
  );
}
