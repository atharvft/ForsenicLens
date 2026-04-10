#!/usr/bin/env python
"""Run ForensicLens AI Backend on Google Colab with ngrok"""
import os
import sys


def main():
    """Main function to run backend on Colab"""
    print("🚀 ForensicLens AI Backend - Colab Deployment")
    print("=" * 60)
    
    # Check if running on Colab
    try:
        import google.colab
        on_colab = True
        print("✅ Running on Google Colab")
    except ImportError:
        on_colab = False
        print("⚠️  Not running on Colab (running locally)")
    
    # Check GPU availability
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        if gpu_available:
            gpu_name = torch.cuda.get_device_name(0)
            print(f"✅ GPU Available: {gpu_name}")
        else:
            print("⚠️  No GPU available. Consider switching to GPU runtime.")
    except Exception as e:
        print(f"⚠️  Could not check GPU: {e}")
    
    # Setup ngrok
    ngrok_token = os.environ.get('NGROK_AUTH_TOKEN')
    if ngrok_token and ngrok_token != 'your-ngrok-auth-token-here':
        print("\n🌐 Setting up ngrok tunnel...")
        try:
            from pyngrok import ngrok, conf
            conf.get_default().auth_token = ngrok_token
            
            # Start tunnel
            public_url = ngrok.connect(8000)
            
            print("\n" + "=" * 60)
            print("🎉 ForensicLens AI Backend is now accessible at:")
            print(f"\n   {public_url}\n")
            print("Copy this URL and use it in your Next.js frontend!")
            print("API Docs:", f"{public_url}/docs")
            print("=" * 60 + "\n")
            
            # Save URL to file
            with open('ngrok_url.txt', 'w') as f:
                f.write(str(public_url))
                
        except Exception as e:
            print(f"❌ Error setting up ngrok: {e}")
            print("Continuing without ngrok...")
    else:
        print("\n⚠️  NGROK_AUTH_TOKEN not set. Running without public URL.")
        print("Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken")
    
    # Start the server
    print("\n🚀 Starting FastAPI server...\n")
    
    import uvicorn
    from app.main import app
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )


if __name__ == "__main__":
    main()
