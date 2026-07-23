import CRMPipeline from "./CRMPipeline";
import Login from "./Login";
import { useAuth } from "./AuthContext";

export default function App() {
  const { user } = useAuth();
  return user ? <CRMPipeline /> : <Login />;
}
