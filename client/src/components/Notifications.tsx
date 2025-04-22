import { FC } from "react";
import { Notification } from "@/lib/types";

interface NotificationsProps {
  notifications: Notification[];
}

const Notifications: FC<NotificationsProps> = ({ notifications }) => {
  return (
    <div 
      id="notification-container" 
      className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-2 z-20"
    >
      {notifications.map((notification) => {
        let bgColor;
        switch (notification.type) {
          case 'error':
            bgColor = 'bg-status-error';
            break;
          case 'success':
            bgColor = 'bg-status-success';
            break;
          case 'warning':
            bgColor = 'bg-status-warning';
            break;
          default:
            bgColor = 'bg-status-info';
        }
        
        return (
          <div 
            key={notification.id}
            className={`${bgColor} text-white px-4 py-2 rounded-lg shadow-lg transform transition-opacity duration-300`}
          >
            {notification.message}
          </div>
        );
      })}
    </div>
  );
};

export default Notifications;
