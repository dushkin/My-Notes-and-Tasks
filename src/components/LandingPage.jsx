import React from 'react';
import { motion } from 'framer-motion';
import Button from './ui/button';
import { Card, CardContent } from './ui/card';

export default function LandingPage({ onLogin, onSignup, currentUser }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="relative z-10 backdrop-blur-sm bg-white/80 border-b border-gray-200/50">
        <div className="flex justify-between items-center p-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">📝</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Notes & Tasks
            </h1>
          </div>
          <nav>
            {currentUser ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                  👋 Welcome back, <span className="font-medium">{currentUser.email}</span>
                </span>
                <a 
                  href="/app" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium"
                >
                  Go to App →
                </a>
              </div>
            ) : (
              <button 
                onClick={onLogin} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-blue-300"
              >
                🔐 Personal Area
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
          
          <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <div className="lg:w-1/2 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="text-5xl lg:text-6xl font-bold leading-tight">
                    Organize Your{' '}
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Digital Life
                    </span>{' '}
                    & To‑Dos
                  </h2>
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-xl text-gray-600 leading-relaxed"
                >
                  A powerful, intuitive platform that transforms how you capture ideas, build knowledge bases, manage tasks, and stay productive. Everything you need to turn thoughts into action.
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  {currentUser ? (
                    <a 
                      href="/app"
                      className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200"
                    >
                      ✨ Access Your Notes & Tasks
                    </a>
                  ) : (
                    <>
                      <button 
                        onClick={onSignup}
                        className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200"
                      >
                        🚀 Get Started Free
                      </button>
                      <button 
                        onClick={() => {
                          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                      >
                        💎 View Pricing
                      </button>
                    </>
                  )}
                </motion.div>

                {/* Feature highlights */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="flex flex-wrap gap-6 pt-6"
                >
                  {['🎯 Smart Organization', '⚡ Lightning Fast', '🔒 Secure & Private'].map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2 text-gray-600">
                      <span className="text-lg">{feature.split(' ')[0]}</span>
                      <span className="font-medium">{feature.split(' ').slice(1).join(' ')}</span>
                    </div>
                  ))}
                </motion.div>
              </div>

              <motion.div 
                className="lg:w-1/2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-20 transform rotate-6"></div>
                  <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200/50">
                    {/* App header mockup */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-12 flex items-center px-6">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-white/30"></div>
                        <div className="w-3 h-3 rounded-full bg-white/30"></div>
                        <div className="w-3 h-3 rounded-full bg-white/30"></div>
                      </div>
                      <div className="ml-4 text-white text-sm font-medium">Notes & Tasks</div>
                    </div>
                    
                    {/* Two-panel layout mockup */}
                    <div className="flex h-80">
                      {/* Left panel - Tree structure */}
                      <div className="w-1/2 p-4 bg-gray-50/50 border-r border-gray-200">
                        <div className="space-y-2 text-sm">
                          {/* Work Projects folder */}
                          <div className="flex items-center space-x-2 text-gray-700">
                            <span className="text-blue-500">▾</span>
                            <span className="text-base">📁</span>
                            <span className="font-medium">Work Projects</span>
                          </div>
                          
                          {/* Nested items under Work Projects */}
                          <div className="ml-6 space-y-1.5">
                            <div className="flex items-center space-x-2 text-gray-600 bg-blue-50 px-2 py-1 rounded">
                              <span className="text-base">📝</span>
                              <span className="text-blue-700 font-medium">Meeting Notes</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600">
                              <span className="text-base">✅</span>
                              <span className="line-through opacity-60 text-xs">Setup repository</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600">
                              <span className="text-base">⬜️</span>
                              <span className="text-xs">Review mockups</span>
                            </div>
                          </div>

                          {/* Personal folder */}
                          <div className="flex items-center space-x-2 text-gray-700 mt-3">
                            <span className="text-blue-500">▸</span>
                            <span className="text-base">📁</span>
                            <span className="font-medium">Personal</span>
                          </div>

                          {/* Knowledge Base folder */}
                          <div className="flex items-center space-x-2 text-gray-700">
                            <span className="text-blue-500">▾</span>
                            <span className="text-base">📁</span>
                            <span className="font-medium">Knowledge Base</span>
                          </div>
                          
                          {/* Nested items under Knowledge Base */}
                          <div className="ml-6 space-y-1.5">
                            <div className="flex items-center space-x-2 text-gray-600">
                              <span className="text-blue-500">▸</span>
                              <span className="text-base">📁</span>
                              <span className="text-xs">React Dev</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600">
                              <span className="text-base">📝</span>
                              <span className="text-xs">API Docs</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600">
                              <span className="text-base">📝</span>
                              <span className="text-xs">Resources</span>
                            </div>
                          </div>

                          {/* Shopping folder */}
                          <div className="flex items-center space-x-2 text-gray-700">
                            <span className="text-blue-500">▸</span>
                            <span className="text-base">📁</span>
                            <span className="font-medium">Shopping</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right panel - Content preview */}
                      <div className="w-1/2 p-4 bg-white">
                        <div className="h-full">
                          <div className="text-xs text-gray-500 mb-3 flex items-center space-x-2">
                            <span>📝</span>
                            <span>Meeting Notes - Q1 Planning</span>
                          </div>
                          <div className="space-y-3">
                            <div className="h-2 bg-gray-200 rounded w-full"></div>
                            <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                            <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                            
                            <div className="mt-4 space-y-2">
                              <div className="text-xs font-medium text-gray-700 mb-2">Action Items:</div>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <div className="h-1.5 bg-gray-200 rounded w-3/5"></div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <div className="h-1.5 bg-gray-200 rounded w-4/5"></div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <div className="h-1.5 bg-gray-200 rounded w-2/5"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
        
        {!currentUser && (
          <section id="pricing" className="py-20 bg-white/50">
            <div className="max-w-7xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h3 className="text-4xl font-bold text-gray-900 mb-4">
                  Simple, Transparent Pricing
                </h3>
                <p className="text-xl text-gray-600">
                  Choose the plan that works best for you
                </p>
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="relative overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-all duration-300">
                    <CardContent className="p-8">
                      <div className="text-center mb-6">
                        <h4 className="text-2xl font-bold text-gray-900 mb-2">Free Plan</h4>
                        <div className="text-4xl font-bold text-blue-600 mb-1">$0</div>
                        <div className="text-gray-500">Forever free</div>
                      </div>
                      <ul className="space-y-4 mb-8">
                        {['Up to 5 notes', 'Basic editor features', 'Tree view organization', 'Email support'].map((feature, index) => (
                          <li key={index} className="flex items-center space-x-3">
                            <span className="text-green-500">✓</span>
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={onSignup} 
                        className="w-full py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-all duration-200"
                      >
                        Get Started Free
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  <Card className="relative overflow-hidden border-2 border-blue-500 shadow-xl shadow-blue-500/25">
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm font-medium">
                      ⭐ Most Popular
                    </div>
                    <CardContent className="p-8 pt-12">
                      <div className="text-center mb-6">
                        <h4 className="text-2xl font-bold text-gray-900 mb-2">Pro Plan</h4>
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1">$9</div>
                        <div className="text-gray-500">per month</div>
                      </div>
                      <ul className="space-y-4 mb-8">
                        {['Unlimited notes & tasks', 'Rich text & Markdown support', 'Advanced organization', 'Priority support', 'Cloud sync', 'Export features'].map((feature, index) => (
                          <li key={index} className="flex items-center space-x-3">
                            <span className="text-green-500">✓</span>
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                        Start Pro Trial
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-gray-600">
            <p>© 2025 Notes & Tasks. Made with ❤️ for productivity enthusiasts.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}