import React from 'react';
import { useUser } from '../hooks/useUser';

interface UserProfileProps {
  userId: string;
  showAvatar?: boolean;
}

export function UserProfile({ userId, showAvatar = true }: UserProfileProps) {
  const { user, isLoading, error } = useUser(userId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      {showAvatar && <img src={user.avatar} alt={user.name} />}
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <span className="role">{user.role}</span>
    </div>
  );
}
