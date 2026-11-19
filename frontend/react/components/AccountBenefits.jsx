import mascot from '../../images/signup-mascot.png';
import '../../css/account-benefits.css';

const benefits = [
  {
    icon: 'history',
    title: 'Save your meal history',
    description: 'Keep track of your past meals and analysis results.',
  },
  {
    icon: 'heart',
    title: 'Get personalized insights',
    description: 'Receive recommendations tailored to your goals.',
  },
  {
    icon: 'habits',
    title: 'Build healthier habits',
    description: 'Set preferences and let PlatePal grow with you.',
  },
];

function BenefitIcon({ type }) {
  if (type === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="12" width="4" height="9" rx="0.8" />
        <rect x="10" y="3" width="4" height="18" rx="0.8" />
        <rect x="17" y="7" width="4" height="14" rx="0.8" />
      </svg>
    );
  }

  if (type === 'heart') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m21.3 10.3-1.8-.6a8 8 0 0 0-.6-1.4l.9-1.7-2.4-2.4-1.7.9a8 8 0 0 0-1.4-.6L13.7 2h-3.4l-.6 2.5a8 8 0 0 0-1.4.6l-1.7-.9-2.4 2.4.9 1.7a8 8 0 0 0-.6 1.4L2 10.3v3.4l2.5.6a8 8 0 0 0 .6 1.4l-.9 1.7 2.4 2.4 1.7-.9a8 8 0 0 0 1.4.6l.6 2.5h3.4l.6-2.5a8 8 0 0 0 1.4-.6l1.7.9 2.4-2.4-.9-1.7a8 8 0 0 0 .6-1.4l1.8-.6v-3.4ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

export default function AccountBenefits() {
  return (
    <section className="account-benefits" aria-labelledby="account-benefits-title">
      <div className="account-benefits__mascot">
        <img src={mascot} alt="" width="240" height="240" />
      </div>

      <div className="account-benefits__content">
        <h2 id="account-benefits-title">More than just meal analysis.</h2>
        <p className="account-benefits__intro">Create an account to get the full PlatePal experience.</p>

        <ul className="account-benefits__list" role="list">
          {benefits.map(({ icon, title, description }) => (
            <li className="account-benefits__item" key={icon}>
              <span className="account-benefits__icon"><BenefitIcon type={icon} /></span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
