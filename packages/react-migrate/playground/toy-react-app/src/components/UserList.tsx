import React from 'react';
import { User } from '../types';
import { UserProfile } from './UserProfile';

interface UserListProps {
  users: User[];
  onSelectUser: (userId: string) => void;
}

export function UserList({ users, onSelectUser }: UserListProps) {
  if (users.length === 0) {
    return <div className="empty">No users found</div>;
  }

  return (
    <ul className="user-list">
      {users.map((user) => (
        <li key={user.id} onClick={() => onSelectUser(user.id)}>
          <UserProfile userId={user.id} showAvatar={false} />
        </li>
      ))}
    </ul>
  );
}
