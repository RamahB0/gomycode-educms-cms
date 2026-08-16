import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicHome from './pages/PublicHome';
import PublicPost from './pages/PublicPost';
import PostList from './pages/admin/PostList';
import PostEditor from './pages/admin/PostEditor';
import Categories from './pages/admin/Categories';
import Comments from './pages/admin/Comments';
import Users from './pages/admin/Users';

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/posts/:slug" element={<PublicPost />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/admin/posts"
          element={
            <ProtectedRoute minRole="author">
              <PostList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/posts/new"
          element={
            <ProtectedRoute minRole="author">
              <PostEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/posts/:id/edit"
          element={
            <ProtectedRoute minRole="author">
              <PostEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute minRole="editor">
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/comments"
          element={
            <ProtectedRoute minRole="editor">
              <Comments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute minRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
