const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

// Create checkout session for subscription
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { priceId, successUrl, cancelUrl } = req.body;
    
    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: priceId, successUrl, or cancelUrl'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.email,
        metadata: {
          userId: user._id.toString()
        }
      });
      
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      subscription_data: {
        metadata: {
          userId: user._id.toString()
        }
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user._id.toString()
    });
    
    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
};

// Get user's current subscription
exports.getSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If no subscription ID, return empty subscription
    if (!user.stripeSubscriptionId) {
      return res.status(200).json({
        success: true,
        subscription: null,
        status: 'no_subscription'
      });
    }
    
    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    
    // Format response
    const response = {
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        priceId: subscription.items.data[0].price.id,
        productId: subscription.items.data[0].price.product,
        amount: subscription.items.data[0].price.unit_amount / 100, // Convert from cents
        currency: subscription.items.data[0].price.currency,
        interval: subscription.items.data[0].price.recurring.interval
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription',
      error: error.message
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If no subscription ID, return error
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    // Cancel at period end
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

// Resume canceled subscription
exports.resumeSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If no subscription ID, return error
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    // Resume subscription by setting cancel_at_period_end to false
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume subscription',
      error: error.message
    });
  }
};

// Update subscription (change plan)
exports.updateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { priceId } = req.body;
    
    if (!priceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: priceId'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If no subscription ID, return error
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    
    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId
          }
        ],
        proration_behavior: 'create_prorations'
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
        priceId: updatedSubscription.items.data[0].price.id
      }
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
};

// Create portal session (for subscription management)
exports.createPortalSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { returnUrl } = req.body;
    
    if (!returnUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: returnUrl'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // If no Stripe customer ID, return error
    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found'
      });
    }
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl
    });
    
    res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session',
      error: error.message
    });
  }
};

// Handle webhook events from Stripe
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).json({
      success: false,
      message: 'Missing Stripe signature'
    });
  }
  
  let event;
  
  try {
    // Verify signature
    event = stripe.webhooks.constructEvent(
      req.rawBody, // This requires proper Express setup - see notes below
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${err.message}`
    });
  }
  
  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

// Webhook helper functions
async function handleCheckoutSessionCompleted(session) {
  if (session.mode !== 'subscription') return;
  
  try {
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    // Get customer ID from session
    const customerId = session.customer;
    
    // Find user by either client_reference_id or customerId
    let user;
    
    if (session.client_reference_id) {
      user = await User.findById(session.client_reference_id);
    }
    
    if (!user && customerId) {
      user = await User.findOne({ stripeCustomerId: customerId });
    }
    
    if (!user) {
      console.error('User not found for checkout session:', session.id);
      return;
    }
    
    // Update user subscription info
    user.stripeCustomerId = customerId;
    user.stripeSubscriptionId = subscription.id;
    user.subscriptionStatus = subscription.status;
    user.accountType = 'paid';
    
    await user.save();
    
    console.log(`User ${user._id} subscription updated: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling checkout.session.completed:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    // Find user by subscription metadata or by customerId
    let user;
    
    if (subscription.metadata && subscription.metadata.userId) {
      user = await User.findById(subscription.metadata.userId);
    }
    
    if (!user && subscription.customer) {
      user = await User.findOne({ stripeCustomerId: subscription.customer });
    }
    
    if (!user) {
      console.error('User not found for subscription:', subscription.id);
      return;
    }
    
    // Update user subscription info
    user.subscriptionStatus = subscription.status;
    
    // Handle status changes
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      user.accountType = 'paid';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      // Give some grace period - you could implement more complex logic here
      // For now, we'll just keep their account as paid until subscription fully ends
      // A more sophisticated approach would check subscription end date
    }
    
    await user.save();
    
    console.log(`User ${user._id} subscription updated: ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    // Find user by subscription metadata or by customerId
    let user;
    
    if (subscription.metadata && subscription.metadata.userId) {
      user = await User.findById(subscription.metadata.userId);
    }
    
    if (!user && subscription.customer) {
      user = await User.findOne({ stripeCustomerId: subscription.customer });
    }
    
    if (!user) {
      console.error('User not found for subscription:', subscription.id);
      return;
    }
    
    // Update user subscription info
    user.subscriptionStatus = 'canceled';
    user.accountType = 'free';
    
    await user.save();
    
    console.log(`User ${user._id} subscription canceled`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  try {
    if (!invoice.subscription) return;
    
    // Find user by customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    
    if (!user) {
      console.error('User not found for invoice:', invoice.id);
      return;
    }
    
    // Successful payment typically means active subscription
    user.subscriptionStatus = 'active';
    user.accountType = 'paid';
    
    await user.save();
    
    console.log(`User ${user._id} payment succeeded for invoice ${invoice.id}`);
  } catch (error) {
    console.error('Error handling invoice payment success:', error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice) {
  try {
    if (!invoice.subscription) return;
    
    // Find user by customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    
    if (!user) {
      console.error('User not found for invoice:', invoice.id);
      return;
    }
    
    // Mark subscription as past_due, but typically you'll want a more sophisticated retry strategy
    user.subscriptionStatus = 'past_due';
    
    await user.save();
    
    console.log(`User ${user._id} payment failed for invoice ${invoice.id}`);
  } catch (error) {
    console.error('Error handling invoice payment failure:', error);
    throw error;
  }
}

// IMPORTANT NOTES FOR THE WEBHOOK IMPLEMENTATION:
// 1. You'll need to configure Express to provide the raw body for Stripe signature verification:
//    app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));
//    This middleware should be placed BEFORE the express.json() middleware but only for the webhook route.
//
// 2. You need to configure the Stripe webhook in your Stripe dashboard, pointing to your webhook URL.
//
// 3. You need to set the STRIPE_WEBHOOK_SECRET in your environment variables.