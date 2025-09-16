import { Link } from "react-router-dom";

export default function Header() {
    return (
        <header className="flex justify-between items-center bg-gray-800 text-white px-6 py-3">
            {/* Left side */}
            <div className="flex items-center space-x-6">
                <h1 className="text-lg font-bold">Lending-workflow</h1>
                <Link to="/applications" className="hover:underline">
                    My applications
                </Link>
                <Link to="/how-to-use" className="hover:underline">
                    How to use
                </Link>

            </div>

            {/* Right side */}
            <div>
                <select className="text-black rounded px-2 py-1">
                    <option value="user1">User 1</option>
                    <option value="user2">User 2</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        </header>
    );
}
