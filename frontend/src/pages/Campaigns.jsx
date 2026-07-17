import React from 'react';
import { Navigate } from 'react-router-dom';

const Campaigns = () => {
  // Redirect to history as the default campaign view
  return <Navigate to="/history" replace />;
};

export default Campaigns;
