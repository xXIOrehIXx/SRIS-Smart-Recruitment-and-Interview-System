import React from 'react';
import './css/Header.css';
import Button from '../Button/Button';

const Header = () => {
  return (
    <header className="header">
      <div className="header-logo">
        <h2>Teamtailor</h2>
      </div>
      <nav className="header-nav">
        <ul>
          <li><a href="#product">Product</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#resources">Resources</a></li>
          <li><a href="#customers">Customers</a></li>
        </ul>
      </nav>
      <div className="header-actions">
        <a href="#login" className="login-link">Log in</a>
        <Button type="primary">Book a demo</Button>
      </div>
    </header>
  );
};

export default Header;